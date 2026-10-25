import { getJson, setJson } from '../../../../utils/redis'
import { requireAgent } from '../../../../utils/security'
import { jobKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) return { ok: true, deleted: true }
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  if (job.cancelRequested || ['cancelled','done','failed'].includes(job.status)) return { ok: true, ignored: true }
  const body = await readBody(event)
  job.statusCode = String(body?.statusCode || 'processing').slice(0, 80)
  job.message = String(body?.message || '').slice(0, 500)
  if (job.status !== 'needs_review') job.status = 'processing'
  await setJson(event, jobKey(id), job)
  return { ok: true }
})
