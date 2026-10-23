import { redisCommand } from '../../utils/redis'
import { requireAgent } from '../../utils/security'
import { agentSeenKey, queueKey } from '../../utils/unified'
const claim = `
for i=1,10 do
 local id=redis.call('RPOP',KEYS[1])
 if not id then return nil end
 local key='tarabil:unified:job:'..id
 local raw=redis.call('GET',key)
 if raw then
  local job=cjson.decode(raw)
  if job.status=='pending' and job.deviceId==ARGV[1] then
   job.status='processing'
   job.startedAt=ARGV[2]
   job.attempts=(job.attempts or 0)+1
   local result=cjson.encode(job)
   redis.call('SET',key,result,'EX',604800)
   return result
  end
 end
end
return nil`
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const deviceId = requireAgent(event)
  await redisCommand(event, ['SET', agentSeenKey(deviceId), new Date().toISOString(), 'EX', 180])
  const raw = await redisCommand(event, ['EVAL', claim, 1, queueKey(deviceId), deviceId, new Date().toISOString()])
  return { ok: true, job: raw ? JSON.parse(String(raw)) : null }
})
