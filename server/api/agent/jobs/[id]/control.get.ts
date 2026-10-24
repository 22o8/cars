import { getJson } from '../../../../utils/redis'
import { requireAgent } from '../../../../utils/security'
import { jobKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) return { ok: true, cancelRequested: true, deleted: true }
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  return {
    ok: true,
    cancelRequested: !!job.cancelRequested || job.status === 'cancelling' || job.status === 'cancelled',
    deleteAfterCancel: !!job.deleteAfterCancel,
    status: job.status,
    review: job.review ? { id: job.review.id, state: job.review.state, decision: job.review.decision || '', decisionAt: job.review.decisionAt || '' } : null
  }
})
