import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'purchases')
  return prisma.purchase.findMany({ orderBy: { createdAt: 'desc' } })
})
