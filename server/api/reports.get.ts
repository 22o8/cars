import { prisma } from '../utils/db'
import { syncInstallments } from '../utils/installments'
import { requirePermission } from '../utils/auth'
import { getUsdRate, n, toIqd, roundMoney } from '../utils/money'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'reports')
  await syncInstallments(prisma)
  const [usdRate, sales, expenses, installments] = await Promise.all([
    getUsdRate(prisma),
    prisma.sale.findMany({ include: { customer: true, car: true }, orderBy: { saleDate: 'desc' } }),
    prisma.expense.findMany(),
    prisma.installment.findMany()
  ])
  const totalSalesIqd = roundMoney(sales.reduce((a,s)=>a+toIqd(s.salePrice, s.currency, usdRate),0))
  const debtIqd = roundMoney(sales.reduce((a,s)=>a+toIqd(s.remainingAmount, s.currency, usdRate),0))
  const expenseIqd = roundMoney(expenses.reduce((a,e)=>a+toIqd(e.amount, e.currency, usdRate),0))
  const grossProfitIqd = roundMoney(sales.reduce((a,s)=>a+toIqd(Math.max(n(s.salePrice)-n(s.car.purchasePrice),0), s.currency, usdRate),0))
  const netProfitIqd = roundMoney(grossProfitIqd-expenseIqd)
  const overdue = installments.filter(i=>i.status!=='PAID'&&new Date(i.dueDate)<new Date()).length
  return { totalSalesIqd, debtIqd, expenseIqd, grossProfitIqd, netProfitIqd, overdue, latestSales:sales.slice(0,20), usdRate }
})
