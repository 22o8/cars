import { z } from 'zod'
import { prisma } from '../../../utils/db'
import { requirePermission } from '../../../utils/auth'
import { audit } from '../../../utils/audit'

const schema = z.object({
  months: z.number().int().min(0).max(60).default(0),
  days: z.number().int().min(0).max(365).default(0),
  applyTo: z.enum(['remaining', 'current']).default('remaining'),
  notes: z.string().optional().nullable()
})

function extendDate(date: Date, months: number, days: number) {
  const d = new Date(date)
  if (months > 0) d.setMonth(d.getMonth() + months)
  if (days > 0) d.setDate(d.getDate() + days)
  return d
}

function calcStatus(amount: number, paidAmount: number, dueDate: Date) {
  if (paidAmount >= amount) return 'PAID'
  if (paidAmount > 0) return 'PARTIAL'
  return dueDate < new Date() ? 'LATE' : 'PENDING'
}

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'installments')
  const id = getRouterParam(event, 'id')!
  const body = schema.parse(await readBody(event))

  if (body.months === 0 && body.days === 0) {
    throw createError({ statusCode: 400, message: 'اختر مدة تمديد صحيحة' })
  }

  const result = await prisma.$transaction(async (tx) => {
    const base = await tx.installment.findUnique({
      where: { id },
      include: { sale: { include: { customer: true, car: true } } }
    })

    if (!base) throw createError({ statusCode: 404, message: 'القسط غير موجود' })
    if (base.status === 'PAID') throw createError({ statusCode: 400, message: 'لا يمكن تمديد قسط مسدد' })

    const where = body.applyTo === 'current'
      ? { id: base.id }
      : {
          saleId: base.saleId,
          status: { not: 'PAID' as const },
          installmentNumber: { gte: base.installmentNumber }
        }

    const installments = await tx.installment.findMany({
      where,
      orderBy: { installmentNumber: 'asc' }
    })

    if (!installments.length) throw createError({ statusCode: 400, message: 'لا توجد أقساط قابلة للتمديد' })

    for (const installment of installments) {
      const newDueDate = extendDate(installment.dueDate, body.months, body.days)
      await tx.installment.update({
        where: { id: installment.id },
        data: {
          dueDate: newDueDate,
          status: calcStatus(Number(installment.amount), Number(installment.paidAmount), newDueDate) as any
        }
      })
    }

    await tx.auditLog.create({
      data: {
        userName: user.fullName,
        action: 'تمديد مدة الأقساط',
        entity: 'Installment',
        entityId: base.id,
        details: `تم تمديد ${installments.length} قسط. أشهر: ${body.months}، أيام: ${body.days}. ${body.notes || ''}`
      }
    })

    return {
      updated: installments.length,
      customer: base.sale.customer.fullName,
      car: `${base.sale.car.brand} ${base.sale.car.model}`
    }
  })

  await audit(user.fullName, 'تمديد مدة الأقساط', 'Installment', id, `عدد الأقساط: ${result.updated}`)
  return { ok: true, ...result }
})
