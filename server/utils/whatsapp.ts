import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import type { H3Event } from 'h3'
import { getJson, redisCommand } from './redis'
import { jobKey, reviewScreenshotKey, type UnifiedCloudJob } from './unified'

export type WhatsAppDelivery = { status: 'queued'|'sending'|'accepted'|'delivered'|'read'|'failed'|'unknown'|'skipped'; updatedAt: string; attempt?: string; messageId?: string; errorCode?: string }
export const waKey = (id: string) => `tarabil:whatsapp:job:${id}`
const waQueue = (device: string) => `tarabil:whatsapp:queue:${device}`
export function approvedReview(job: UnifiedCloudJob) {
  return [job.review, ...(job.reviewHistory || [])].find(r => r?.state === 'PROCEDURE_CREATED_WAITING_COMPLETION' && r.decision === 'finalize_and_complete' && r.resolvedAt && String(r.metadata?.procedureNo || '') === job.unifiedProcedureNo)
}
export function eligibleWhatsApp(job: UnifiedCloudJob) {
  return job.kind === 'execute' && job.status === 'done' && job.statusCode === 'PROCEDURE_COMPLETED' && !job.cancelRequested && /^\d+$/.test(job.unifiedProcedureNo || '') && !!job.whatsappNumber && !!approvedReview(job)
}
export function normalizeWhatsAppPhone(input: string) {
  let n = String(input || '').replace(/[\s()+-]/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (/^07\d{9}$/.test(n)) n = '964' + n.slice(1)
  if (!/^[1-9]\d{7,14}$/.test(n)) throw new Error('invalid_recipient')
  return n
}
export function whatsappReady(cfg: any) {
  return !!(cfg.whatsappAccessToken && /^\d+$/.test(cfg.whatsappPhoneNumberId || '') && /^v\d+\.\d+$/.test(cfg.whatsappGraphVersion || '') && /^[a-z0-9_]+$/.test(cfg.whatsappTemplateName || '') && cfg.whatsappTemplateLanguage)
}
const enqueueScript = `-- whatsapp_enqueue
if redis.call('EXISTS',KEYS[1])==1 then return 0 end
redis.call('SET',KEYS[1],ARGV[2],'EX',604800)
redis.call('LPUSH',KEYS[2],ARGV[1])
return 1`
export async function enqueueWhatsApp(event: H3Event, job: UnifiedCloudJob) {
  if (!eligibleWhatsApp(job)) return
  await redisCommand(event, ['EVAL', enqueueScript, 2, waKey(job.id), waQueue(job.deviceId), job.id, JSON.stringify({status:'queued',updatedAt:new Date().toISOString()})])
}
export async function getWhatsAppDelivery(event: H3Event, id: string): Promise<WhatsAppDelivery | null> {
  const delivery = await getJson<WhatsAppDelivery>(event, waKey(id))
  if (delivery?.status === 'queued' && !whatsappReady(useRuntimeConfig(event))) return {...delivery,errorCode:'whatsapp_not_configured'}
  if (delivery?.status === 'sending' && Date.now() - Date.parse(delivery.updatedAt) > 120000) return {...delivery,status:'unknown',errorCode:'delivery_uncertain'}
  return delivery
}
// Updates are atomic and monotonic: an HTTP response must not overwrite a newer delivery webhook.
const updateScript = `-- whatsapp_update
local raw=redis.call('GET',KEYS[1])
if not raw then return 0 end
local old=cjson.decode(raw)
local new=cjson.decode(ARGV[1])
if new.attempt and old.attempt~=new.attempt then return 0 end
if old.status=='read' then return 0 end
if old.status=='delivered' and new.status~='read' then return 0 end
if old.status=='failed' and (new.status=='accepted' or new.status=='unknown') then return 0 end
if old.messageId and new.messageId and old.messageId~=new.messageId then return 0 end
if new.messageId then old.messageId=new.messageId end
old.status=new.status
old.updatedAt=new.updatedAt
old.errorCode=new.errorCode
redis.call('SET',KEYS[1],cjson.encode(old),'EX',604800)
return 1`
export async function updateWhatsApp(event: H3Event, id: string, state: Partial<WhatsAppDelivery>) {
  return redisCommand(event, ['EVAL', updateScript, 1, waKey(id), JSON.stringify({...state,updatedAt:new Date().toISOString()})])
}
const claimScript = `-- whatsapp_claim
for i=1,25 do
 local id=redis.call('RPOP',KEYS[1])
 if not id then return nil end
 local key='tarabil:whatsapp:job:'..id
 local raw=redis.call('GET',key)
 if raw then
  local state=cjson.decode(raw)
  if state.status=='queued' then
   state.status='sending'; state.updatedAt=ARGV[1]; state.attempt=ARGV[2]
   redis.call('SET',key,cjson.encode(state),'EX',604800)
   return id
  end
 end
end
return nil`
export function buildWhatsAppTemplate(cfg: any, job: UnifiedCloudJob, mediaId: string, attempt: string) {
  return { messaging_product:'whatsapp', to:normalizeWhatsAppPhone(job.whatsappNumber), type:'template', biz_opaque_callback_data:job.id+':'+attempt,
    template:{name:cfg.whatsappTemplateName,language:{code:cfg.whatsappTemplateLanguage},components:[
      {type:'header',parameters:[{type:'image',image:{id:mediaId}}]},
      {type:'body',parameters:[{type:'text',text:job.unifiedProcedureNo},{type:'text',text:job.companyName || job.companyCode}]}
    ]}}
}
export async function dispatchWhatsApp(event: H3Event, device: string) {
  const cfg = useRuntimeConfig(event)
  if (!whatsappReady(cfg)) return {ok:true,configured:false}
  const attempt = randomUUID()
  const id = await redisCommand(event, ['EVAL', claimScript, 1, waQueue(device), new Date().toISOString(), attempt]) as string | null
  if (!id) return {ok:true,idle:true}
  let messageStarted = false
  try {
    const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
    if (!job || job.deviceId !== device || !eligibleWhatsApp(job)) {
      await updateWhatsApp(event,id,{attempt,status:'skipped',errorCode:'job_not_eligible'}); return {ok:true,skipped:true}
    }
    normalizeWhatsAppPhone(job.whatsappNumber)
    const review = approvedReview(job)!
    // The approved creation image contains the actual number; the final image may show a closed form.
    const shot = await redisCommand(event,['GET',reviewScreenshotKey(id,review.id)])
    if (!shot || !/^image\/(png|jpeg|webp)$/.test(review.screenshotMime || '')) throw new Error('approved_screenshot_missing')
    const base = `https://graph.facebook.com/${cfg.whatsappGraphVersion}/${cfg.whatsappPhoneNumberId}`
    const headers = {Authorization:`Bearer ${cfg.whatsappAccessToken}`}
    const form = new FormData()
    form.append('messaging_product','whatsapp')
    const bytes = new Uint8Array(Buffer.from(String(shot),'base64'))
    form.append('file',new Blob([bytes],{type:review.screenshotMime}), 'procedure.' + (review.screenshotMime === 'image/png' ? 'png' : review.screenshotMime === 'image/webp' ? 'webp' : 'jpg'))
    const uploaded = await fetch(base+'/media',{method:'POST',headers,body:form,signal:AbortSignal.timeout(12000)})
    if (!uploaded.ok) throw new Error('media_upload_rejected')
    const media = await uploaded.json() as any
    if (!media.id) throw new Error('media_upload_invalid')
    const payload = buildWhatsAppTemplate(cfg,job,String(media.id),attempt)
    messageStarted = true
    const response = await fetch(base+'/messages',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)})
    if (!response.ok) {
      // A transport/server failure may have occurred after acceptance; never retry blindly.
      if (response.status >= 500) throw new Error('delivery_uncertain')
      messageStarted = false
      const body = await response.json().catch(()=>({})) as any
      throw new Error('meta_' + (Number(body.error?.code) || response.status))
    }
    const body = await response.json() as any
    const messageId = body.messages?.[0]?.id
    if (!messageId) throw new Error('delivery_uncertain')
    await updateWhatsApp(event,id,{attempt,status:'accepted',messageId:String(messageId)})
    return {ok:true,accepted:true}
  } catch (error) {
    const safeCodes = /^(invalid_recipient|approved_screenshot_missing|media_upload_rejected|media_upload_invalid|meta_\d+)$/
    const code = error instanceof Error && safeCodes.test(error.message) ? error.message : messageStarted ? 'delivery_uncertain' : 'upload_or_storage_failed'
    await updateWhatsApp(event,id,{attempt,status:messageStarted?'unknown':'failed',errorCode:code})
    return {ok:true,accepted:false}
  }
}
export function validWhatsAppSignature(raw: string, signature: string, secret: string) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false
  const expected = 'sha256=' + createHmac('sha256',secret).update(raw).digest('hex')
  return timingSafeEqual(Buffer.from(signature),Buffer.from(expected))
}
