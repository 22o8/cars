import { prisma } from '../utils/db'
import { syncInstallments } from '../utils/installments'
import { requirePermission } from '../utils/auth'
import { getUsdRate, n, toIqd, roundMoney } from '../utils/money'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reports')
  await syncInstallments(prisma)
  const [usdRate, sales, expenses, installments, purchases] = await Promise.all([
    getUsdRate(prisma),
    prisma.sale.findMany({ include: { customer: true, car: true }, orderBy: { saleDate: 'desc' } }),
    prisma.expense.findMany(),
    prisma.installment.findMany(),
    prisma.purchase.findMany({ orderBy: { createdAt: 'desc' } })
  ])
  const totalSalesIqd = roundMoney(sales.reduce((a,s)=>a+toIqd(s.salePrice, s.currency, usdRate),0))
  const debtIqd = roundMoney(sales.reduce((a,s)=>a+toIqd(s.remainingAmount, s.currency, usdRate),0))
  const purchaseIqd = roundMoney(purchases.reduce((a,p)=>a+toIqd(p.totalAmount, p.currency, usdRate),0))
  const purchaseDebtIqd = roundMoney(purchases.reduce((a,p)=>a+toIqd(p.remainingAmount, p.currency, usdRate),0))
  const expenseIqd = roundMoney(expenses.reduce((a,e)=>a+toIqd(e.amount, e.currency, usdRate),0))
  const grossProfitIqd = roundMoney(sales.reduce((a,s)=>a+toIqd(Math.max(n(s.salePrice)-n(s.car.purchasePrice),0), s.currency, usdRate),0))
  const netProfitIqd = roundMoney(grossProfitIqd-expenseIqd)
  const overdue = installments.filter(i=>i.status!=='PAID'&&new Date(i.dueDate)<new Date()).length
  return { totalSalesIqd, debtIqd, purchaseIqd, purchaseDebtIqd, expenseIqd, grossProfitIqd, netProfitIqd, overdue, latestSales:sales.slice(0,20), latestPurchases:purchases.slice(0,20), usdRate }
})
