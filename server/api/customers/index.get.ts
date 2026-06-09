import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
export default defineEventHandler(async (event) => { await requirePermission(event,'customers'); return prisma.customer.findMany({ orderBy: { createdAt: 'desc' } }) })
