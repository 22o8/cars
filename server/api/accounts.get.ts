import { prisma } from '../utils/db'
import { requirePermission } from '../utils/auth'
import { getUsdRate, sumIqd } from '../utils/money'
import { syncInstallments } from '../utils/installments'

export default defineEventHandler(async(event)=>{
  await requirePermission(event, 'accounts')
  await syncInstallments(prisma)
  const [transactions, usdRate] = await Promise.all([
    prisma.cashboxTransaction.findMany({orderBy:{createdAt:'desc'}, take:250}),
    getUsdRate(prisma)
  ])
  const incomeIqd = sumIqd(transactions, 'amount', usdRate, t => t.type === 'INCOME')
  const expenseIqd = sumIqd(transactions, 'amount', usdRate, t => t.type === 'EXPENSE')
  return { incomeIqd, expenseIqd, balanceIqd: incomeIqd - expenseIqd, usdRate, transactions }
})
