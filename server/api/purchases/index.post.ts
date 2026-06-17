import { z } from 'zod'
import { ensurePurchaseTable } from '../../utils/schema'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'

const schema = z.object({
  sellerName: z.string().min(1, 'اسم البائع مطلوب'),
  sellerPhone: z.string().optional().nullable(),
  carName: z.string().min(1, 'اسم السيارة مطلوب'),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().optional().nullable(),
  totalAmount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  currency: z.enum(['IQD', 'USD']).default('IQD'),
  durationDays: z.number().min(0).default(0),
  fromDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  imageUrls: z.any().optional().nullable(),
  createCar: z.boolean().optional().default(true)
})

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'purchases')
  await ensurePurchaseTable()
  const b = schema.parse(await readBody(event))
  const paid = Math.min(Number(b.paidAmount || 0), Number(b.totalAmount || 0))
  const remaining = Math.max(Number(b.totalAmount || 0) - paid, 0)
  const from = b.fromDate ? new Date(b.fromDate) : new Date()
  const due = b.durationDays > 0 ? new Date(from) : null
  if (due) due.setDate(from.getDate() + Number(b.durationDays || 0))
  const status = remaining <= 0 ? 'PAID' : (due && due < new Date() ? 'LATE' : 'OPEN')

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        sellerName: b.sellerName,
        sellerPhone: b.sellerPhone || null,
        carName: b.carName,
        brand: b.brand || null,
        model: b.model || null,
        year: b.year || null,
        totalAmount: b.totalAmount,
        paidAmount: paid,
        remainingAmount: remaining,
        currency: b.currency,
        durationDays: b.durationDays,
        fromDate: from,
        dueDate: due,
        status,
        notes: b.notes || null,
        imageUrls: b.imageUrls || []
      }
    })
    if (paid > 0) {
      await tx.cashboxTransaction.create({
        data: {
          type: 'EXPENSE',
          amount: paid,
          currency: b.currency,
          description: `واصل شراء سيارة: ${b.carName} من ${b.sellerName}`,
          referenceId: p.id
        }
      })
    }
    if (b.createCar) {
      const parts = String(b.carName || '').split(' ').filter(Boolean)
      await tx.car.create({
        data: {
          brand: b.brand || parts[0] || 'غير محدد',
          model: b.model || parts.slice(1).join(' ') || b.carName,
          year: Number(b.year || new Date().getFullYear()),
          purchasePrice: b.totalAmount,
          salePrice: 0,
          currency: b.currency,
          status: 'AVAILABLE',
          imageUrls: b.imageUrls || [],
          description: `تمت إضافتها من عملية شراء. البائع: ${b.sellerName}. الباقي: ${remaining}`
        }
      })
    }
    return p
  })

  await audit(user.fullName, 'شراء سيارة', 'Purchase', purchase.id, `السيارة: ${b.carName} | الواصل: ${paid} | الباقي: ${remaining}`)
  return purchase
})
