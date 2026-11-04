import { requireMobilePin } from '../../../../utils/security'
import { getJson, redisCommand } from '../../../../utils/redis'
import { jobKey, type UnifiedCloudJob } from '../../../../utils/unified'
import { eligibleWhatsApp, waKey } from '../../../../utils/whatsapp'
const retry = `-- whatsapp_retry
local raw=redis.call('GET',KEYS[1])
if not raw then return 0 end
local state=cjson.decode(raw)
if state.status~='failed' then return 0 end
state.status='queued';state.updatedAt=ARGV[2];state.messageId=nil;state.errorCode=nil
redis.call('SET',KEYS[1],cjson.encode(state),'EX',604800)
redis.call('LPUSH',KEYS[2],ARGV[1])
return 1`
export default defineEventHandler(async event => {
 requireMobilePin(event)
 const id=getRouterParam(event,'id') || ''
 const job=await getJson<UnifiedCloudJob>(event,jobKey(id))
 if(!job || !eligibleWhatsApp(job)) throw createError({statusCode:409,statusMessage:'لا يوجد إنجاز معتمد قابل للإرسال.'})
 const changed=await redisCommand(event,['EVAL',retry,2,waKey(id),`tarabil:whatsapp:queue:${job.deviceId}`,id,new Date().toISOString()])
 if(!changed) throw createError({statusCode:409,statusMessage:'الإرسال ليس في حالة فشل مؤكدة؛ لن نكرر رسالة محتملة الوصول.'})
 return {ok:true}
})
