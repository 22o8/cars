import { getJson, redisCommand } from '../../../../utils/redis'
import { requireMobilePin } from '../../../../utils/security'
import { jobKey, queueKey, recentKey, type UnifiedCloudJob } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (job) await redisCommand(event, ['LREM', queueKey(job.deviceId), 0, id])
  await redisCommand(event, ['LREM', recentKey, 0, id])
  await redisCommand(event, ['DEL', jobKey(id)])
  // A running agent polls the control endpoint; a missing job is an explicit cancel signal.
  return { ok: true, deleted: true }
})
