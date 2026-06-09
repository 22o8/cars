import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
export default defineEventHandler(async(event)=>{ await requireUser(event); return prisma.backupLog.findMany({orderBy:{createdAt:'desc'}, take:50}) })
