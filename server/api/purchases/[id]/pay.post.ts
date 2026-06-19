import { z } from 'zod'
import { ensurePurchaseTable } from '../../../utils/schema'
import { prisma } from '../../../utils/db'
import { requirePermission } from '../../../utils/auth'
import { audit } from '../../../utils/audit'
import { sendPurchasePaidOneSignalAlert } from '../../../utils/onesignal'

const schema = z.object({ amount: z.number().positive().optional(), notes: z.string().optional().nullable() }).optional()

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'purchases')
  await ensurePurchaseTable()
  const id = String(getRouterParam(event, 'id'))
  const body = schema.parse(await readBody(event).catch(() => ({})) || {}) || {}

  const result = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.findUnique({ where: { id } })
    if (!p) throw createError({ statusCode: 404, message: 'عملية الشراء غير موجودة' })
    if (String(p.status) === 'PAID' || Number(p.remainingAmount) <= 0) throw createError({ statusCode: 400, message: 'عملية الشراء مسددة مسبقاً' })

    const remaining = Math.max(Number(p.remainingAmount || 0), 0)
    const amount = Math.min(Number(body.amount || remaining), remaining)
    if (amount <= 0) throw createError({ statusCode: 400, message: 'مبلغ التسديد غير صحيح' })

    const newPaid = Number(p.paidAmount || 0) + amount
    const newRemaining = Math.max(Number(p.totalAmount || 0) - newPaid, 0)
    const fullyPaid = newRemaining <= 0

    const updated = await tx.purchase.update({
      where: { id },
      data: { paidAmount: newPaid, remainingAmount: newRemaining, status: fullyPaid ? 'PAID' : 'OPEN' }
    })

    await tx.cashboxTransaction.create({
      data: {
        type: 'EXPENSE',
        amount,
        currency: p.currency,
        description: fullyPaid ? `تسديد باقي شراء سيارة: ${p.carName}` : `دفعة على شراء سيارة: ${p.carName}`,
        referenceId: p.id
      }
    })

    return { updated, amount, fullyPaid, sellerName: p.sellerName, carName: p.carName, currency: p.currency }
  })

  await audit(user.fullName, 'تسديد دفعة شراء', 'Purchase', id, `المبلغ: ${result.amount}`)
  const notification = await sendPurchasePaidOneSignalAlert({
    purchaseId: id,
    sellerName: result.sellerName,
    carName: result.carName,
    amount: result.amount,
    currency: result.currency,
    fullyPaid: result.fullyPaid
  }).catch((error: any) => ({ ok: false, sent: 0, failed: 1, error: error?.message }))

  return { ...result.updated, notification }
})
