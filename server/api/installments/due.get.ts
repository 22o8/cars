import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { syncInstallments } from '../../utils/installments'
export default defineEventHandler(async(event)=>{
  await requireUser(event)
  await syncInstallments(prisma)
  const now=new Date()
  return prisma.installment.findMany({ where:{ status:{not:'PAID'}, dueDate:{lte:now}}, include:{ sale:{include:{customer:true,car:true}}}, orderBy:{dueDate:'asc'} })
})
