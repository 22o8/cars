import { getJson, redisCommand } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { jobKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const ids = (await redisCommand(event, ['LRANGE', recentKey, 0, 29]) || []) as string[]
  const jobs: UnifiedCloudJob[] = []
  for (const id of ids) {
    const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
    if (job) {
      if (!job.kind) job.kind = job.companyCode ? 'execute' : 'test'
      jobs.push(job)
    }
  }
  return { ok: true, jobs }
})
