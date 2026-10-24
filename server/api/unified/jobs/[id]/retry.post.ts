import { getJson, redisCommand, setJson } from '../../../../utils/redis'
import { requireMobilePin } from '../../../../utils/security'
import { finalScreenshotKey, jobKey, queueKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'الطلب غير موجود.' })
  if (!['test', 'test_navigation'].includes(job.kind)) throw createError({ statusCode: 409, statusMessage: 'التنفيذ الحقيقي يحتاج مراجعة يدوية قبل إعادة المحاولة' })
  if (job.status !== 'failed') throw createError({ statusCode: 409, statusMessage: 'يمكن إعادة محاولة الطلب الفاشل فقط' })
  job.status = 'pending'
  job.error = ''
  job.statusCode = undefined
  job.message = undefined
  job.screenshotTaken = false
  job.screenshotName = ''
  job.screenshotAvailable = false
  job.screenshotMime = undefined
  await redisCommand(event, ['DEL', finalScreenshotKey(id)])
  job.startedAt = undefined
  job.finishedAt = undefined
  job.unifiedProcedureNo = ''
  job.whatsappSent = false
  if (job.review) job.reviewHistory = [...(job.reviewHistory || []), job.review].slice(-12)
  job.review = undefined
  job.cancelRequested = false
  job.cancelRequestedAt = undefined
  await setJson(event, jobKey(id), job)
  await redisCommand(event, ['LPUSH', queueKey(job.deviceId), id])
  return { ok: true, job }
})
