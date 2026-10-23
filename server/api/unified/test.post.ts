import { randomUUID } from 'node:crypto'
import { redisCommand, setJson } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { jobKey, queueKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const cfg = useRuntimeConfig(event)
  const id = randomUUID()
  const job: UnifiedCloudJob = {
    id,
    kind: 'test',
    status: 'pending',
    deviceId: String(cfg.agentDeviceId || 'asycuda-office-1'),
    companyCode: '',
    companyName: 'اختبار الاتصال',
    whatsappNumber: '',
    serial: '',
    requestedAt: new Date().toISOString(),
    attempts: 0
  }
  await setJson(event, jobKey(id), job)
  await redisCommand(event, ['LPUSH', queueKey(job.deviceId), id])
  await redisCommand(event, ['LPUSH', recentKey, id])
  await redisCommand(event, ['LTRIM', recentKey, 0, 49])
  return { ok: true, job }
})
