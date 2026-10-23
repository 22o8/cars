import { randomUUID } from 'node:crypto'
import { redisCommand, setJson } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { jobKey, queueKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const body = await readBody(event)
  const companyCode = String(body?.companyCode || '').trim()
  const whatsappNumber = String(body?.whatsappNumber || '').replace(/\D/g, '')
  const companyName = String(body?.companyName || '').trim()
  const serial = String(body?.serial || '').trim()
  if (!companyCode) throw createError({ statusCode: 400, statusMessage: 'أدخل رمز الشركة.' })
  if (!/^\d{8,20}$/.test(companyCode)) throw createError({ statusCode: 400, statusMessage: 'رمز الشركة غير صالح.' })
  if (!/^\d{10,15}$/.test(whatsappNumber)) throw createError({ statusCode: 400, statusMessage: 'رقم واتساب غير صالح. استخدم رمز الدولة بدون +.' })
  const cfg = useRuntimeConfig(event)
  const id = randomUUID()
  const job: UnifiedCloudJob = {
    id,
    status: 'pending',
    mode: 'create',
    deviceId: String(cfg.agentDeviceId || 'asycuda-office-1'),
    companyCode,
    companyName,
    whatsappNumber,
    serial,
    requestedAt: new Date().toISOString(),
    attempts: 0
  }
  await setJson(event, jobKey(id), job)
  await redisCommand(event, ['LPUSH', queueKey(job.deviceId), id])
  await redisCommand(event, ['LPUSH', recentKey, id])
  await redisCommand(event, ['LTRIM', recentKey, 0, 49])
  return { ok: true, job }
})
