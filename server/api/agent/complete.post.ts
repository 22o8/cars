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
  job.status = body?.ok ? 'done' : 'failed'
  job.finishedAt = new Date().toISOString()
  job.unifiedProcedureNo = String(body?.unifiedProcedureNo || '').trim()
  job.whatsappSent = !!body?.whatsappSent
  job.error = body?.ok ? '' : String(body?.error || 'فشل التنفيذ على جهاز الأسيكودا')
  await setJson(event, jobKey(id), job)
  return { ok: true, job }
})
