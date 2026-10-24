import { getJson, redisCommand } from '../../../utils/redis'
import { requireMobilePin } from '../../../utils/security'
import { jobKey, queueKey, recentKey, finalScreenshotKey, reviewScreenshotKey, type UnifiedCloudJob } from '../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const ids = (await redisCommand(event, ['LRANGE', recentKey, 0, 199]) || []) as string[]
  let deleted = 0
  for (const id of ids) {
    const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
    if (job) {
      await redisCommand(event, ['LREM', queueKey(job.deviceId), 0, id])
      const reviewIds = [job.review?.id, ...(job.reviewHistory || []).map(r=>r.id)].filter(Boolean) as string[]
      for (const rid of reviewIds) await redisCommand(event, ['DEL', reviewScreenshotKey(id, rid)])
      await redisCommand(event, ['DEL', finalScreenshotKey(id)])
    }
    await redisCommand(event, ['LREM', recentKey, 0, id])
    await redisCommand(event, ['DEL', jobKey(id)])
    deleted++
  }
  return { ok: true, deleted, stopping: 0 }
})
