import { getJson, redisCommand, setJson } from '../../../../utils/redis'
import { requireMobilePin } from '../../../../utils/security'
import { jobKey, queueKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'الطلب غير موجود.' })
  if (job.status === 'processing') throw createError({ statusCode: 409, statusMessage: 'الطلب قيد التنفيذ حالياً.' })
  job.status = 'pending'
  job.error = ''
  job.startedAt = undefined
  job.finishedAt = undefined
  job.unifiedProcedureNo = ''
  job.whatsappSent = false
  job.screenshotCaptured = false
  await setJson(event, jobKey(id), job)
  await redisCommand(event, ['LPUSH', queueKey(job.deviceId), id])
  return { ok: true, job }
})
