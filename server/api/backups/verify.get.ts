import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings')
  const [users, cars, customers, sales, installments, invoices, cashbox, logs] = await Promise.all([
    prisma.user.count(), prisma.car.count(), prisma.customer.count(), prisma.sale.count(), prisma.installment.count(), prisma.invoice.count(), prisma.cashboxTransaction.count(), prisma.auditLog.count()
  ])
  return { ok: true, checkedAt: new Date(), counts: { users, cars, customers, sales, installments, invoices, cashbox, auditLogs: logs } }
})
