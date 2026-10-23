import { getJson, redisCommand, setJson } from '../../utils/redis'
import { requireAgent } from '../../utils/security'
import { agentSeenKey, jobKey, queueKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  await redisCommand(event, ['SET', agentSeenKey(deviceId), new Date().toISOString(), 'EX', 180])
  for (let i = 0; i < 10; i++) {
    const id = await redisCommand(event, ['RPOP', queueKey(deviceId)])
    if (!id) return { ok: true, job: null }
    const job = await getJson<UnifiedCloudJob>(event, jobKey(String(id)))
    if (!job || job.status !== 'pending') continue
    job.status = 'processing'
    job.startedAt = new Date().toISOString()
    job.attempts = Number(job.attempts || 0) + 1
    await setJson(event, jobKey(job.id), job)
    return { ok: true, job }
  }
  return { ok: true, job: null }
})
