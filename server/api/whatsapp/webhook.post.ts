import { getJson } from '../../utils/redis'
import { jobKey, type UnifiedCloudJob } from '../../utils/unified'
import { getWhatsAppDelivery, updateWhatsApp, validWhatsAppSignature } from '../../utils/whatsapp'
export default defineEventHandler(async event => {
  const cfg=useRuntimeConfig(event)
  const raw=await readRawBody(event) || ''
  if (raw.length>1000000) throw createError({statusCode:413,statusMessage:'payload too large'})
  if (!validWhatsAppSignature(raw,String(getHeader(event,'x-hub-signature-256') || ''),String(cfg.whatsappAppSecret || '')))
    throw createError({statusCode:401,statusMessage:'invalid signature'})
  let body:any
  try { body=JSON.parse(raw) } catch { throw createError({statusCode:400,statusMessage:'invalid JSON'}) }
  if (body.object!=='whatsapp_business_account') return {ok:true}
  for (const entry of body.entry || []) for (const change of entry.changes || []) {
    const value=change.value
    if (change.field!=='messages' || String(value?.metadata?.phone_number_id)!==String(cfg.whatsappPhoneNumberId)) continue
    for (const status of value.statuses || []) {
      const [id,attempt]=String(status.biz_opaque_callback_data || '').split(':')
      if (!id || !attempt || !/^[a-f0-9-]{36}$/.test(id) || !['sent','delivered','read','failed'].includes(status.status) || !status.id) continue
      const job=await getJson<UnifiedCloudJob>(event,jobKey(id))
      const existing=await getWhatsAppDelivery(event,id)
      if (!job || !existing || existing.attempt!==attempt || !['sending','unknown','accepted','delivered','read','failed'].includes(existing.status)) continue
      if (existing.messageId && existing.messageId!==status.id) continue
      await updateWhatsApp(event,id,{attempt,status:status.status==='sent'?'accepted':status.status,messageId:String(status.id),errorCode:status.status==='failed'?'meta_'+(Number(status.errors?.[0]?.code)||0):undefined})
    }
  }
  return {ok:true}
})
