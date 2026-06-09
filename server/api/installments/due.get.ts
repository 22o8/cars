import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
export default defineEventHandler(async(event)=>{ await requireUser(event); const now=new Date(); return prisma.installment.findMany({ where:{ status:{not:'PAID'}, dueDate:{lte:now}}, include:{ sale:{include:{customer:true,car:true}}}, orderBy:{dueDate:'asc'} }) })
