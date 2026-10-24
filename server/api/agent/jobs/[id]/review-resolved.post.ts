import { getJson, setJson } from '../../../../utils/redis'
import { requireAgent } from '../../../../utils/security'
import { jobKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) return { ok: true, deleted: true }
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  const body = await readBody(event)
  const reviewId = String(body?.reviewId || '')
  if (job.review?.id === reviewId) {
    job.review.resolvedAt = new Date().toISOString()
    await setJson(event, jobKey(id), job)
  }
  return { ok: true }
})
