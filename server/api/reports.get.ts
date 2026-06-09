import { prisma } from '../utils/db'
import { syncInstallments } from '../utils/installments'
import { requireUser } from '../utils/auth'
export default defineEventHandler(async (event) => {
  await requireUser(event)
  await syncInstallments(prisma)
  const [sales, expenses, installments] = await Promise.all([
    prisma.sale.findMany({ include: { customer: true, car: true }, orderBy: { saleDate: 'desc' } }),
    prisma.expense.findMany(),
    prisma.installment.findMany()
  ])
  const n=(v:any)=>Number(v||0)
  const totalSalesIqd=sales.reduce((a,s)=>a+(s.currency==='IQD'?n(s.salePrice):0),0)
  const debtIqd=sales.reduce((a,s)=>a+(s.currency==='IQD'?n(s.remainingAmount):0),0)
  const expenseIqd=expenses.reduce((a,e)=>a+(e.currency==='IQD'?n(e.amount):0),0)
  const grossProfitIqd=sales.reduce((a,s)=>a+(s.currency==='IQD'?Math.max(n(s.salePrice)-n(s.car.purchasePrice),0):0),0)
  const netProfitIqd=grossProfitIqd-expenseIqd
  const overdue=installments.filter(i=>i.status!=='PAID'&&new Date(i.dueDate)<new Date()).length
  return { totalSalesIqd, debtIqd, expenseIqd, grossProfitIqd, netProfitIqd, overdue, latestSales:sales.slice(0,20) }
})
