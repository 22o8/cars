import { getJson, redisCommand, setJson } from '../../../../utils/redis'
import { requireMobilePin } from '../../../../utils/security'
import { jobKey, queueKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'الطلب غير موجود.' })

  if (['pending', 'processing', 'needs_review', 'cancelling'].includes(job.status)) {
    job.status = 'cancelled'
    job.cancelRequested = true
    job.cancelRequestedAt = new Date().toISOString()
    job.finishedAt = job.cancelRequestedAt
    job.statusCode = 'cancelled_by_user'
    job.message = 'تم إيقاف الطلب بواسطة المستخدم.'
    job.error = ''
    await redisCommand(event, ['LREM', queueKey(job.deviceId), 0, id])
    await setJson(event, jobKey(id), job)
  }
  return { ok: true, job }
})
