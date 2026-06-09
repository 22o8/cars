import { prisma } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = getHeader(event, 'authorization')?.replace('Bearer ', '') || String(getQuery(event).secret || '')
    if (provided !== secret) throw createError({ statusCode: 401, message: 'غير مصرح' })
  }
  const [cars, customers, sales, installments, invoices] = await Promise.all([
    prisma.car.count(), prisma.customer.count(), prisma.sale.count(), prisma.installment.count(), prisma.invoice.count()
  ])
  const item = await prisma.backupLog.create({ data: { title: 'فحص نسخ احتياطي تلقائي', status: 'مكتمل', notes: `سيارات:${cars} عملاء:${customers} مبيعات:${sales} أقساط:${installments} فواتير:${invoices}` } })
  return { ok: true, item, counts: { cars, customers, sales, installments, invoices } }
})
