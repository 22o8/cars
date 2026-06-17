import { z } from 'zod'
import { ensurePurchaseTable } from '../../utils/schema'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'

const schema = z.object({
  sellerName: z.string().min(1, 'اسم صاحب السيارة مطلوب'),
  sellerPhone: z.string().optional().nullable(),
  carName: z.string().min(1, 'اسم السيارة مطلوب'),
  totalAmount: z.number().min(0).optional().default(0),
  paidAmount: z.number().min(0).default(0),
  remainingAmount: z.number().min(0).optional().default(0),
  currency: z.enum(['IQD', 'USD']).default('IQD'),
  durationUnit: z.enum(['DAYS', 'MONTHS']).default('DAYS'),
  durationValue: z.number().min(0).default(0),
  fromDate: z.string().optional().nullable(),
  documentImages: z.any().optional().nullable(),
  notes: z.string().optional().nullable(),
  createCar: z.boolean().optional().default(true)
})

function splitCarName(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return {
    brand: parts[0] || 'غير محدد',
    model: parts.slice(1).join(' ') || parts[0] || 'غير محدد'
  }
}

function calculateDueDate(fromDate: Date, unit: 'DAYS' | 'MONTHS', value: number) {
  const d = new Date(fromDate)
  const n = Math.max(0, Number(value || 0))
  if (unit === 'MONTHS') d.setMonth(d.getMonth() + n)
  else d.setDate(d.getDate() + n)
  return d
}

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'purchases')
  await ensurePurchaseTable()
  const body = schema.parse(await readBody(event))

  const totalInput = Number(body.totalAmount || 0)
  const paid = Math.min(Number(body.paidAmount || 0), Math.max(totalInput, Number(body.paidAmount || 0)))
  const remaining = totalInput > 0 ? Math.max(totalInput - paid, 0) : Number(body.remainingAmount || 0)
  const total = totalInput > 0 ? totalInput : paid + remaining
  if (total <= 0) throw createError({ statusCode: 400, message: 'اكتب سعر السيارة الكلي أو الواصل حتى يتم إنشاء الشراء' })

  const from = body.fromDate ? new Date(body.fromDate) : new Date()
  const dueDate = remaining > 0 ? calculateDueDate(from, body.durationUnit, body.durationValue) : null
  const durationDays = body.durationUnit === 'MONTHS' ? Number(body.durationValue || 0) * 30 : Number(body.durationValue || 0)
  const docs = Array.isArray(body.documentImages) ? body.documentImages : []
  const carParts = splitCarName(body.carName)

  const purchase = await prisma.$transaction(async (tx) => {
    const p = await tx.purchase.create({
      data: {
        sellerName: body.sellerName,
        sellerPhone: body.sellerPhone || null,
        carName: body.carName,
        brand: carParts.brand,
        model: carParts.model,
        totalAmount: total,
        paidAmount: paid,
        remainingAmount: remaining,
        currency: body.currency,
        durationDays,
        fromDate: from,
        dueDate,
        status: remaining <= 0 ? 'PAID' : (dueDate && dueDate < new Date() ? 'LATE' : 'OPEN'),
        notes: body.notes || null,
        imageUrls: docs
      }
    })

    if (paid > 0) {
      await tx.cashboxTransaction.create({ data: { type: 'EXPENSE', amount: paid, currency: body.currency, description: `واصل شراء سيارة: ${body.carName} من ${body.sellerName}`, referenceId: p.id } })
    }

    if (body.createCar) {
      await tx.car.create({
        data: {
          brand: carParts.brand,
          model: carParts.model,
          year: new Date().getFullYear(),
          purchasePrice: total,
          salePrice: 0,
          currency: body.currency,
          status: 'AVAILABLE',
          imageUrls: docs,
          description: `تمت إضافتها من التنفيذ السريع للشراء. صاحب السيارة: ${body.sellerName}. الباقي: ${remaining}`
        }
      })
    }

    return p
  })

  await audit(user.fullName, 'شراء سريع', 'Purchase', purchase.id, `السيارة: ${body.carName} | الواصل: ${paid} | الباقي: ${remaining}`)
  return purchase
})
