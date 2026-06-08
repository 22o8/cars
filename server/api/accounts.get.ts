import { prisma } from '../utils/db'
import { requireUser } from '../utils/auth'
export default defineEventHandler(async(event)=>{ await requireUser(event); const transactions=await prisma.cashboxTransaction.findMany({orderBy:{createdAt:'desc'}, take:100}); const n=(v:any)=>Number(v||0); const incomeIqd=transactions.reduce((a,t)=>a+(t.currency==='IQD'&&t.type==='INCOME'?n(t.amount):0),0); const expenseIqd=transactions.reduce((a,t)=>a+(t.currency==='IQD'&&t.type==='EXPENSE'?n(t.amount):0),0); return {incomeIqd, expenseIqd, balanceIqd:incomeIqd-expenseIqd, transactions} })
