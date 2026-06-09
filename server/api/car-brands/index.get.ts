import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
export default defineEventHandler(async(event)=>{ await requireUser(event); return prisma.carBrand.findMany({orderBy:{createdAt:'desc'}}) })
