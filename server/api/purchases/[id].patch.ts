import { z } from 'zod'
import { ensurePurchaseTable } from '../../utils/schema'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'

const schema = z.object({
  sellerName: z.string().min(1).optional(),
  sellerPhone: z.string().optional().nullable(),
  carName: z.string().min(1).optional(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().optional().nullable(),
  totalAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).optional(),
  currency: z.enum(['IQD','USD']).optional(),
  durationDays: z.number().min(0).optional(),
  fromDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  imageUrls: z.any().optional().nullable()
})

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event,'purchases')
  await ensurePurchaseTable()
  const id = String(getRouterParam(event,'id'))
  const old = await prisma.purchase.findUnique({ where: { id } })
  if (!old) throw createError({ statusCode: 404, message: 'عملية الشراء غير موجودة' })
  const b = schema.parse(await readBody(event))
  const total = b.totalAmount !== undefined ? b.totalAmount : Number(old.totalAmount)
  const paid = Math.min(b.paidAmount !== undefined ? b.paidAmount : Number(old.paidAmount), total)
  const remaining = Math.max(total - paid, 0)
  const from = b.fromDate ? new Date(b.fromDate) : old.fromDate
  const duration = b.durationDays !== undefined ? b.durationDays : old.durationDays
  const due = duration > 0 ? new Date(from) : null
  if (due) due.setDate(from.getDate() + Number(duration || 0))
  const status = remaining <= 0 ? 'PAID' : (due && due < new Date() ? 'LATE' : 'OPEN')
  const purchase = await prisma.purchase.update({ where: { id }, data: { ...b, paidAmount: paid, remainingAmount: remaining, fromDate: from, durationDays: duration, dueDate: due, status } })
  await audit(user.fullName,'تعديل شراء سيارة','Purchase',id,`الواصل: ${paid} | الباقي: ${remaining}`)
  return purchase
})
