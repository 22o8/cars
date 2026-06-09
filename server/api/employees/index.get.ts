import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
export default defineEventHandler(async(event)=>{ await requirePermission(event,'employees'); return prisma.user.findMany({select:{id:true,fullName:true,username:true,role:true,active:true,profileImage:true,permissions:true,createdAt:true}, orderBy:{createdAt:'asc'}}) })
