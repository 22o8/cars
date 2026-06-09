import { prisma } from '../utils/db'
import { requirePermission } from '../utils/auth'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings')
  const query = getQuery(event)
  const take = Math.min(Number(query.take || 100), 300)
  return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take })
})
