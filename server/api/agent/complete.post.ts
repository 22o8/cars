import { getJson, redisCommand, setJson } from '../../utils/redis'
import { requireAgent } from '../../utils/security'
import { jobKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const body = await readBody(event)
  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing job id' })
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) return { ok: true, deleted: true }
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') return { ok: true, job }
  if (!['processing', 'cancelling'].includes(job.status)) throw createError({ statusCode: 409, statusMessage: 'job is not processing' })

  const statusCode = String(body?.statusCode || '').slice(0, 80)
  const cancelled = statusCode === 'cancelled_by_user' || job.cancelRequested === true

  if (!cancelled && body?.ok && ['test','test_navigation'].includes(job.kind) && (statusCode !== 'TEST_SUCCESS' || body?.screenshotTaken !== true)) {
    throw createError({ statusCode: 400, statusMessage: 'navigation proof missing' })
  }

  job.statusCode = cancelled ? 'cancelled_by_user' : statusCode
  job.message = cancelled ? 'تم إيقاف الطلب بواسطة المستخدم.' : String(body?.message || '').slice(0, 300)
  job.status = cancelled ? 'cancelled' : (body?.ok === true ? 'done' : 'failed')
  job.finishedAt = new Date().toISOString()
  job.unifiedProcedureNo = cancelled ? '' : String(body?.unifiedProcedureNo || '').trim()
  job.whatsappSent = cancelled ? false : !!body?.whatsappSent
  job.screenshotTaken = !!body?.screenshotTaken
  job.screenshotName = String(body?.screenshotName || '').trim()
  job.error = cancelled ? '' : (body?.ok ? '' : String(body?.error || 'فشل التنفيذ على جهاز الأسيكودا'))

  if (job.deleteAfterCancel) {
    await redisCommand(event, ['LREM', recentKey, 0, id])
    await redisCommand(event, ['DEL', jobKey(id)])
    return { ok: true, deleted: true }
  }

  await setJson(event, jobKey(id), job)
  return { ok: true, job }
})
