import { getJson, setJson } from '../../utils/redis'
import { requireAgent } from '../../utils/security'
import { jobKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const body = await readBody(event)
  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing job id' })
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'job not found' })
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  if (job.status === 'done' || job.status === 'failed') return { ok: true, job }
  if (job.status !== 'processing') throw createError({ statusCode: 409, statusMessage: 'job is not processing' })
  if (body?.ok && ['test','test_navigation'].includes(job.kind) && (body?.statusCode !== 'TEST_SUCCESS' || body?.screenshotTaken !== true)) throw createError({ statusCode: 400, statusMessage: 'navigation proof missing' })
  job.statusCode = String(body?.statusCode || '').slice(0, 80)
  job.message = String(body?.message || '').slice(0, 300)
  job.status = body?.ok === true ? 'done' : 'failed'
  job.finishedAt = new Date().toISOString()
  job.unifiedProcedureNo = String(body?.unifiedProcedureNo || '').trim()
  job.whatsappSent = !!body?.whatsappSent
  job.screenshotTaken = !!body?.screenshotTaken
  job.screenshotName = String(body?.screenshotName || '').trim()
  job.error = body?.ok ? '' : String(body?.error || 'فشل التنفيذ على جهاز الأسيكودا')
  await setJson(event, jobKey(id), job)
  return { ok: true, job }
})
