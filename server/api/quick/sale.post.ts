import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
import { sendDueInstallmentOneSignalAlerts } from '../../utils/onesignal'

const schema = z.object({
  customerName: z.string().min(1, 'اسم صاحب السيارة مطلوب'),
  customerPhone: z.string().optional().nullable(),
  carName: z.string().min(1, 'اسم السيارة مطلوب'),
  paidAmount: z.number().min(0).default(0),
  remainingAmount: z.number().min(0).default(0),
  currency: z.enum(['IQD', 'USD']).default('IQD'),
  durationUnit: z.enum(['DAYS', 'MONTHS']).default('DAYS'),
  durationValue: z.number().min(0).default(0),
  fromDate: z.string().optional().nullable(),
  documentImages: z.any().optional().nullable(),
  notes: z.string().optional().nullable()
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
  const user = await requirePermission(event, 'sales')
  const body = schema.parse(await readBody(event))

  const paid = Number(body.paidAmount || 0)
  const remaining = Number(body.remainingAmount || 0)
  const salePrice = paid + remaining
  if (salePrice <= 0) throw createError({ statusCode: 400, message: 'اكتب الواصل أو الباقي حتى يتم إنشاء البيع' })

  const from = body.fromDate ? new Date(body.fromDate) : new Date()
  const dueDate = remaining > 0 ? calculateDueDate(from, body.durationUnit, body.durationValue) : null
  const carParts = splitCarName(body.carName)
  const docs = Array.isArray(body.documentImages) ? body.documentImages : []

  const sale = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        fullName: body.customerName,
        phone: body.customerPhone || '',
        documentImages: docs,
        notes: body.notes || null
      }
    })

    let car = await tx.car.findFirst({
      where: {
        status: 'AVAILABLE',
        OR: [
          { model: { contains: body.carName, mode: 'insensitive' } },
          { brand: { contains: carParts.brand, mode: 'insensitive' } },
          { description: { contains: body.carName, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'asc' }
    })

    if (car) {
      car = await tx.car.update({
        where: { id: car.id },
        data: {
          salePrice,
          currency: body.currency,
          status: 'SOLD',
          imageUrls: docs.length ? docs : car.imageUrls,
          description: `${car.description || ''} تم بيعها من التنفيذ السريع. العميل: ${body.customerName}`.trim()
        }
      })
    } else {
      car = await tx.car.create({
        data: {
          brand: carParts.brand,
          model: carParts.model,
          year: new Date().getFullYear(),
          purchasePrice: 0,
          salePrice,
          currency: body.currency,
          status: 'SOLD',
          imageUrls: docs,
          description: `تمت إضافتها من التنفيذ السريع للبيع. العميل: ${body.customerName}`
        }
      })
    }

    const createdSale = await tx.sale.create({
      data: {
        carId: car.id,
        customerId: customer.id,
        soldByUserId: user.id,
        saleType: remaining > 0 ? 'INSTALLMENT' : 'CASH',
        salePrice,
        firstPayment: paid,
        paidAmount: paid,
        remainingAmount: remaining,
        currency: body.currency,
        saleDate: from,
        notes: body.notes || null
      }
    })

    if (paid > 0) {
      await tx.payment.create({ data: { saleId: createdSale.id, amount: paid, currency: body.currency, notes: 'الواصل من التنفيذ السريع' } })
      await tx.cashboxTransaction.create({ data: { type: 'INCOME', amount: paid, currency: body.currency, description: `واصل بيع سيارة: ${body.carName}`, referenceId: createdSale.id } })
    }

    if (remaining > 0 && dueDate) {
      await tx.installment.create({
        data: {
          saleId: createdSale.id,
          installmentNumber: 1,
          amount: remaining,
          paidAmount: 0,
          dueDate,
          status: dueDate < new Date() ? 'LATE' : 'PENDING'
        }
      })
    }

    await tx.invoice.create({
      data: {
        invoiceNumber: `SALE-${Date.now()}`,
        invoiceType: 'فاتورة بيع سيارة',
        saleId: createdSale.id,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        title: `بيع ${body.carName}`,
        amount: salePrice,
        currency: body.currency,
        notes: `الواصل: ${paid} | الباقي: ${remaining}`
      }
    })

    return createdSale
  })

  await audit(user.fullName, 'بيع سريع', 'Sale', sale.id, `السيارة: ${body.carName} | الواصل: ${paid} | الباقي: ${remaining}`)

  let notification: any = null
  if (remaining > 0 && dueDate) {
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    if (dueDate <= todayEnd) notification = await sendDueInstallmentOneSignalAlerts().catch((e: any) => ({ ok: false, sent: 0, error: e?.message }))
  }

  return { ...sale, notification }
})
