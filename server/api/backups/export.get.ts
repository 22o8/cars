import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { ensurePurchaseTable } from '../../utils/schema'

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings')
  await ensurePurchaseTable().catch(() => null)

  const data: any = {
    exportedAt: new Date().toISOString(),
    settings: await safe(() => prisma.dealerSetting.findUnique({ where: { id: 1 } }), null),
    cars: await safe(() => prisma.car.findMany(), []),
    customers: await safe(() => prisma.customer.findMany({ include: { documents: true } }), []),
    sales: await safe(() => prisma.sale.findMany({ include: { installments: true, payments: true, invoices: true } }), []),
    purchases: await safe(() => prisma.purchase.findMany(), []),
    expenses: await safe(() => prisma.expense.findMany(), []),
    cashbox: await safe(() => prisma.cashboxTransaction.findMany(), []),
    invoices: await safe(() => prisma.invoice.findMany(), []),
    users: await safe(() => prisma.user.findMany({ select: { id: true, fullName: true, username: true, role: true, active: true, permissions: true, createdAt: true } }), []),
    auditLogs: await safe(() => prisma.auditLog.findMany(), [])
  }

  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename=autodealer-backup-${Date.now()}.json`)
  return data
})
