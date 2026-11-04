import { randomUUID } from 'node:crypto'
import { redisCommand } from '../../utils/redis'
import { requireMobilePin } from '../../utils/security'
import { queueKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

// One atomic publication: retries of the same mobile request cannot enqueue twice.
const publishBatch = `
local cached=redis.call('GET',KEYS[3])
if cached then
 local old=cjson.decode(cached)
 if old.fingerprint~=ARGV[2] then return cjson.encode({conflict=true}) end
 return cached
end
local jobs=cjson.decode(ARGV[1])
for _,job in ipairs(jobs) do
 redis.call('SET','tarabil:unified:job:'..job.id,cjson.encode(job),'EX',604800)
 redis.call('LPUSH',KEYS[1],job.id)
 redis.call('LPUSH',KEYS[2],job.id)
end
redis.call('LTRIM',KEYS[2],0,49)
local result=cjson.encode({jobs=jobs,fingerprint=ARGV[2]})
redis.call('SET',KEYS[3],result,'EX',604800)
return result`

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const cfg = useRuntimeConfig(event)
  const body = await readBody(event)
  const companyCode = String(body?.companyCode || '').replace(/\D/g, '').slice(0, 20)
  if (!companyCode) throw createError({ statusCode: 400, statusMessage: 'رمز الشركة مطلوب.' })
  const vehicleCount = body?.vehicleCount ?? 1
  if (typeof vehicleCount !== 'number' || !Number.isInteger(vehicleCount) || vehicleCount < 1 || vehicleCount > 20)
    throw createError({ statusCode: 400, statusMessage: 'عدد السيارات يجب أن يكون من 1 إلى 20.' })
  const requestId = body?.requestId ?? randomUUID()
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
    throw createError({ statusCode: 400, statusMessage: 'معرّف الطلب غير صالح.' })
  const batchId = randomUUID()
  const jobs: UnifiedCloudJob[] = []
  for (let vehicleIndex = 1; vehicleIndex <= vehicleCount; vehicleIndex++) {
  const id = randomUUID()
  const job: UnifiedCloudJob = {
    id, kind: 'execute', status: 'pending',
    deviceId: String(cfg.agentDeviceId || 'asycuda-office-1'),
    companyCode, batchId, vehicleCount, vehicleIndex,
    companyName: String(body?.companyName || '').slice(0, 180),
    whatsappNumber: String(body?.whatsappNumber || '').replace(/\D/g, '').slice(0, 24),
    serial: String(body?.serial || '').slice(0, 120),
    requestedAt: new Date().toISOString(), attempts: 0
  }
  jobs.push(job)
  }
  const first = jobs[0]!
  const fingerprint = JSON.stringify([first.companyCode, first.companyName, first.whatsappNumber, first.serial, vehicleCount])
  const raw = await redisCommand(event, ['EVAL', publishBatch, 3, queueKey(first.deviceId), recentKey,
    `tarabil:unified:request:${first.deviceId}:${requestId}`, JSON.stringify(jobs), fingerprint])
  const result = JSON.parse(String(raw)) as { conflict?: boolean; jobs: UnifiedCloudJob[] }
  if (result.conflict) throw createError({ statusCode: 409, statusMessage: 'معرّف الطلب مستخدم لبيانات أخرى.' })
  return { ok: true, job: result.jobs[0], jobs: result.jobs, vehicleCount: result.jobs.length }
})
