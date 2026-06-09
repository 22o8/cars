import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { syncInstallments } from '../../utils/installments'
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'sales')
  await syncInstallments(prisma)
  return prisma.sale.findMany({ include:{ car:true, customer:true, installments:true, payments:true, invoices:true }, orderBy:{ saleDate:'desc' } })
})
