import { getJson, setJson, redisCommand } from '../../../../utils/redis'
import { requireAgent } from '../../../../utils/security'
import { agentSeenKey, jobKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  await redisCommand(event, ['SET', agentSeenKey(deviceId), new Date().toISOString(), 'EX', 60])
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'job not found' })
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  const body = await readBody(event)
  const success = !!body?.success
  job.status = success ? 'done' : 'failed'
  job.finishedAt = new Date().toISOString()
  job.unifiedProcedureNo = String(body?.unifiedProcedureNo || '').trim()
  job.whatsappSent = !!body?.whatsappSent
  job.error = success ? '' : String(body?.error || 'فشل التنفيذ على جهاز الأسيكودا')
  await setJson(event, jobKey(id), job)
  return { ok: true, job }
})
