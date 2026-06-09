import { prisma } from '../utils/db'
import { syncInstallments } from '../utils/installments'
import { requirePermission } from '../utils/auth'
import { getUsdRate, n, toIqd, roundMoney } from '../utils/money'

export default defineEventHandler(async (event) => {
  await requirePermission(event,'dashboard')
  await syncInstallments(prisma)
  const startToday = new Date(); startToday.setHours(0,0,0,0)
  const sixMonths = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - idx))
    return { month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString('ar-IQ', { month: 'long' }) }
  })
  const [usdRate, cars, availableCars, customers, sales, expenses, installments, cash, latestOps] = await Promise.all([
    getUsdRate(prisma),
    prisma.car.count(),
    prisma.car.count({ where: { status: 'AVAILABLE' } }),
    prisma.customer.count(),
    prisma.sale.findMany({ include: { customer: true, car: true }, orderBy: { saleDate: 'desc' } }),
    prisma.expense.findMany(),
    prisma.installment.findMany(),
    prisma.cashboxTransaction.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 })
  ])
  const saleIqd = (s:any)=> toIqd(s.salePrice, s.currency, usdRate)
  const paidIqd = (s:any)=> toIqd(s.paidAmount, s.currency, usdRate)
  const debtIqdOf = (s:any)=> toIqd(s.remainingAmount, s.currency, usdRate)
  const profitIqd = (s:any)=> toIqd(n(s.salePrice) - n(s.car?.purchasePrice), s.currency, usdRate)
  const totalSalesIqd = roundMoney(sales.reduce((a,s)=>a+saleIqd(s),0))
  const totalPaidIqd = roundMoney(sales.reduce((a,s)=>a+paidIqd(s),0))
  const debtIqd = roundMoney(sales.reduce((a,s)=>a+debtIqdOf(s),0))
  const expenseIqd = roundMoney(expenses.reduce((a,e)=>a+toIqd(e.amount, e.currency, usdRate),0))
  const grossProfitIqd = roundMoney(sales.reduce((a,s)=>a+profitIqd(s),0))
  const netProfitIqd = roundMoney(grossProfitIqd - expenseIqd)
  const overdue = installments.filter(i => i.status !== 'PAID' && new Date(i.dueDate) < new Date()).length
  const salesToday = sales.filter(s => new Date(s.saleDate) >= startToday).length
  const cashIqd = roundMoney(cash.reduce((a,t)=>a + toIqd(t.amount, t.currency, usdRate) * (t.type === 'INCOME' ? 1 : -1), 0))
  const chart = sixMonths.map(m => {
    const monthSales = sales.filter(s => new Date(s.saleDate).getMonth() === m.month && new Date(s.saleDate).getFullYear() === m.year)
    return { label: m.label, sales: roundMoney(monthSales.reduce((a,s)=>a+saleIqd(s),0)), profit: roundMoney(monthSales.reduce((a,s)=>a+profitIqd(s),0)) }
  })
  return { cars, availableCars, customers, salesCount: sales.length, salesToday, latestSales: sales.slice(0,6), overdue, cashIqd, totalSalesIqd, totalPaidIqd, expenseIqd, grossProfitIqd, netProfitIqd, debtIqd, chart, latestOps, usdRate }
})
