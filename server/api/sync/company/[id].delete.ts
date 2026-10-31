import { redisCommand } from '../../../utils/redis'
import { bumpRevision, companiesHashKey } from '../../../utils/sharedState'
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'معرف الشركة مطلوب' })
  await redisCommand(event, ['HDEL', companiesHashKey, id])
  const revision = await bumpRevision(event)
  return { ok: true, revision }
})
