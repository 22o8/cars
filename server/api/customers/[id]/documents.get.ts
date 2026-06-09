import { prisma } from '../../../utils/db'
import { requirePermission } from '../../../utils/auth'
export default defineEventHandler(async(event)=>{ await requirePermission(event,'customers'); const customerId=getRouterParam(event,'id')!; return prisma.customerDocument.findMany({where:{customerId},orderBy:{createdAt:'desc'}}) })
