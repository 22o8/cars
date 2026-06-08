import { prisma } from '../utils/db'
import { syncInstallments } from '../utils/installments'
import { requirePermission } from '../utils/auth'
export default defineEventHandler(async (event) => {
  await requirePermission(event,'dashboard')
  await syncInstallments(prisma)
  const startToday = new Date(); startToday.setHours(0,0,0,0)
  const sixMonths = Array.from({ length: 6 }, (_, idx) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - idx)); return { month: d.getMonth(), year: d.getFullYear(), label: d.toLocaleDateString('ar-IQ', { month: 'long' }) } })
  const [cars, availableCars, customers, sales, expenses, installments, cash, latestOps] = await Promise.all([
    prisma.car.count(), prisma.car.count({ where: { status: 'AVAILABLE' } }), prisma.customer.count(), prisma.sale.findMany({ include: { customer: true, car: true }, orderBy: { saleDate: 'desc' } }), prisma.expense.findMany(), prisma.installment.findMany(), prisma.cashboxTransaction.findMany({ orderBy: { createdAt: 'desc' } }), prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 })
  ])
  const n = (v:any)=>Number(v||0)
  const saleIqd = (s:any)=> s.currency === 'IQD' ? n(s.salePrice) : 0
  const profitIqd = (s:any)=> s.currency === 'IQD' ? (n(s.salePrice) - n(s.car?.purchasePrice)) : 0
  const totalSalesIqd = sales.reduce((a,s)=>a+saleIqd(s),0)
  const debtIqd = sales.reduce((a,s)=>a+(s.currency==='IQD'?n(s.remainingAmount):0),0)
  const expenseIqd = expenses.reduce((a,e)=>a+(e.currency==='IQD'?n(e.amount):0),0)
  const grossProfitIqd = sales.reduce((a,s)=>a+profitIqd(s),0)
  const netProfitIqd = grossProfitIqd - expenseIqd
  const overdue = installments.filter(i => i.status !== 'PAID' && new Date(i.dueDate) < new Date()).length
  const salesToday = sales.filter(s => new Date(s.saleDate) >= startToday).length
  const cashIqd = cash.reduce((a,t)=>a + (t.currency === 'IQD' ? n(t.amount) * (t.type === 'INCOME' ? 1 : -1) : 0), 0)
  const chart = sixMonths.map(m => { const monthSales = sales.filter(s => new Date(s.saleDate).getMonth() === m.month && new Date(s.saleDate).getFullYear() === m.year); return { label: m.label, sales: monthSales.reduce((a,s)=>a+saleIqd(s),0), profit: monthSales.reduce((a,s)=>a+profitIqd(s),0) } })
  return { cars, availableCars, customers, salesCount: sales.length, salesToday, latestSales: sales.slice(0,6), overdue, cashIqd, totalSalesIqd, expenseIqd, grossProfitIqd, netProfitIqd, debtIqd, chart, latestOps }
})
