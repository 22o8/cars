import { getJson } from '../../../utils/redis'
import { requireMobilePin } from '../../../utils/security'
import { jobKey, type UnifiedCloudJob } from '../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'الطلب غير موجود.' })
  return { ok: true, job }
})
