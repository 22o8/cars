import { randomUUID } from 'node:crypto'
import { redisCommand, setJson } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { jobKey, queueKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const cfg = useRuntimeConfig(event)
  const body = await readBody(event)
  const companyCode = String(body?.companyCode || '').replace(/\D/g, '').slice(0, 20)
  if (!companyCode) throw createError({ statusCode: 400, statusMessage: 'رمز الشركة مطلوب.' })
  const id = randomUUID()
  const job: UnifiedCloudJob = {
    id, kind: 'execute', status: 'pending',
    deviceId: String(cfg.agentDeviceId || 'asycuda-office-1'),
    companyCode,
    companyName: String(body?.companyName || '').slice(0, 180),
    whatsappNumber: String(body?.whatsappNumber || '').replace(/\D/g, '').slice(0, 24),
    serial: String(body?.serial || '').slice(0, 120),
    requestedAt: new Date().toISOString(), attempts: 0
  }
  await setJson(event, jobKey(id), job)
  await redisCommand(event, ['LPUSH', queueKey(job.deviceId), id])
  await redisCommand(event, ['LPUSH', recentKey, id])
  await redisCommand(event, ['LTRIM', recentKey, 0, 49])
  return { ok: true, job }
})
