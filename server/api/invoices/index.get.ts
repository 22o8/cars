import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { syncInstallments } from '../../utils/installments'
export default defineEventHandler(async(event)=>{
  await requirePermission(event, 'invoices')
  await syncInstallments(prisma)
  return prisma.invoice.findMany({orderBy:{invoiceDate:'desc'}, take:200, include:{sale:{include:{customer:true,car:true}}}})
})
