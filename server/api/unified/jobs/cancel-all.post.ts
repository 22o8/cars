import { getJson, redisCommand, setJson } from '../../../utils/redis'
import { requireMobilePin } from '../../../utils/security'
import { jobKey, queueKey, recentKey, type UnifiedCloudJob } from '../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const ids = (await redisCommand(event, ['LRANGE', recentKey, 0, 99]) || []) as string[]
  let stopped = 0
  for (const id of ids) {
    const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
    if (!job || !['pending', 'processing', 'cancelling'].includes(job.status)) continue
    job.status = 'cancelled'
    job.cancelRequested = true
    job.cancelRequestedAt = new Date().toISOString()
    job.finishedAt = job.cancelRequestedAt
    job.statusCode = 'cancelled_by_user'
    job.message = 'تم إيقاف الطلب بواسطة المستخدم.'
    job.error = ''
    await redisCommand(event, ['LREM', queueKey(job.deviceId), 0, id])
    await setJson(event, jobKey(id), job)
    stopped++
  }
  return { ok: true, stopped }
})
