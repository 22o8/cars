import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { ensurePurchaseTable } from '../../utils/schema'

async function safeCount(fn: () => Promise<number>) {
  try { return await fn() } catch { return 0 }
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings')
  await ensurePurchaseTable().catch(() => null)

  const [
    users, cars, customers, sales, purchases, installments, payments,
    invoices, cashbox, expenses, documents, contacts, logs, backups
  ] = await Promise.all([
    safeCount(() => prisma.user.count()),
    safeCount(() => prisma.car.count()),
    safeCount(() => prisma.customer.count()),
    safeCount(() => prisma.sale.count()),
    safeCount(() => prisma.purchase.count()),
    safeCount(() => prisma.installment.count()),
    safeCount(() => prisma.payment.count()),
    safeCount(() => prisma.invoice.count()),
    safeCount(() => prisma.cashboxTransaction.count()),
    safeCount(() => prisma.expense.count()),
    safeCount(() => prisma.customerDocument.count()),
    safeCount(() => prisma.customerContact.count()),
    safeCount(() => prisma.auditLog.count()),
    safeCount(() => prisma.backupLog.count())
  ])

  return {
    ok: true,
    checkedAt: new Date(),
    counts: {
      users, cars, customers, sales, purchases, installments, payments,
      invoices, cashbox, expenses, documents, contacts, auditLogs: logs, backups
    }
  }
})
