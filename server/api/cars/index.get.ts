import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
export default defineEventHandler(async (event) => { await requirePermission(event,'cars'); return prisma.car.findMany({ orderBy: { createdAt: 'desc' } }) })
