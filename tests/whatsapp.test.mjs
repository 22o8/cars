import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createJiti } from 'jiti'
const jiti=createJiti(import.meta.url)
const store=new Map()
const cfg={redisUrl:'https://redis.invalid',redisToken:'redis-test',agentDeviceId:'test-device',agentDeviceToken:'agent-test',mobilePin:'pin-test',whatsappAccessToken:'token-test',whatsappPhoneNumberId:'123',whatsappGraphVersion:'v99.0',whatsappTemplateName:'tarabil_procedure_completed',whatsappTemplateLanguage:'ar',whatsappAppSecret:'app-test',whatsappVerifyToken:'verify-test'}
globalThis.defineEventHandler=h=>h
globalThis.useRuntimeConfig=()=>cfg
globalThis.getHeader=(e,k)=>e.headers?.[k]
globalThis.getQuery=e=>e.query||{}
globalThis.readBody=async e=>e.body
globalThis.readRawBody=async e=>e.raw
globalThis.getRouterParam=(e,k)=>e.params?.[k]
globalThis.setHeader=()=>{}
globalThis.createError=o=>Object.assign(new Error(o.statusMessage),o)
let mode='ok',sent=[],mediaCount=0,onMessage=null
const reply=(body,code=200)=>({ok:code<400,status:code,json:async()=>body})
globalThis.fetch=async(url,options)=>{
 if(url===cfg.redisUrl){
  const [op,...args]=JSON.parse(options.body);let result=null
  if(op==='GET')result=store.get(args[0])||null
  else if(op==='SET'){store.set(args[0],String(args[1]));result='OK'}
  else if(op==='EVAL'){
   const [script,count,...rest]=args;const keys=rest.slice(0,count),v=rest.slice(count)
   if(script.startsWith('-- whatsapp_enqueue')){
    if(!store.has(keys[0])){store.set(keys[0],v[1]);store.set(keys[1],[v[0],...(store.get(keys[1])||[])]);result=1}else result=0
   } else if(script.startsWith('-- whatsapp_claim')){
    const q=store.get(keys[0])||[]
    for(let n=0;n<25&&q.length;n++){
     const id=q.pop(),key='tarabil:whatsapp:job:'+id,raw=store.get(key)
     if(raw){const state=JSON.parse(raw);if(state.status==='queued'){store.set(key,JSON.stringify({...state,status:'sending',updatedAt:v[0],attempt:v[1]}));result=id;break}}
    }
   } else if(script.startsWith('-- whatsapp_update')){
    const raw=store.get(keys[0]);if(raw){const old=JSON.parse(raw),next=JSON.parse(v[0]);result=0
     if(!(next.attempt&&next.attempt!==old.attempt)&&old.status!=='read'&&!(old.status==='delivered'&&next.status!=='read')&&!(old.status==='failed'&&['accepted','unknown'].includes(next.status))&&!(old.messageId&&next.messageId&&old.messageId!==next.messageId)){
      store.set(keys[0],JSON.stringify({...old,...next,messageId:next.messageId||old.messageId}));result=1
     }
    }
   } else if(script.startsWith('-- whatsapp_retry')){
    const raw=store.get(keys[0]);result=0
    if(raw){const state=JSON.parse(raw);if(state.status==='failed'){store.set(keys[0],JSON.stringify({...state,status:'queued',updatedAt:v[1],messageId:undefined,errorCode:undefined}));store.set(keys[1],[v[0],...(store.get(keys[1])||[])]);result=1}}
   } else throw Error('Unexpected Lua script')
  } else throw Error('Unexpected Redis command '+op)
  return reply({result})
 }
 assert.match(url,/^https:\/\/graph.facebook.com\/v99.0\/123\/(media|messages)$/)
 if(url.endsWith('/media')){mediaCount++;if(mode==='uploadFail')return reply({},400);return reply({id:'image-test'})}
 const body=JSON.parse(options.body);sent.push(body)
 if(onMessage)await onMessage(body)
 if(mode==='timeout')throw Error('private token must not leak')
 if(mode==='metaFail')return reply({error:{code:132001,message:'private details'}},400)
 if(mode==='serverFail')return reply({},500)
 return reply({messages:[{id:'wamid.test'}]})
}
const wa=await jiti.import('../server/utils/whatsapp.ts')
const webhook=await jiti.import('../server/api/whatsapp/webhook.post.ts',{default:true})
const verify=await jiti.import('../server/api/whatsapp/webhook.get.ts',{default:true})
const retry=await jiti.import('../server/api/unified/jobs/[id]/whatsapp-retry.post.ts',{default:true})
const complete=await jiti.import('../server/api/agent/complete.post.ts',{default:true})
const jobId='11111111-1111-4111-8111-111111111111'
function job(){return {id:jobId,deviceId:cfg.agentDeviceId,kind:'execute',status:'done',statusCode:'PROCEDURE_COMPLETED',companyCode:'test-company',companyName:'شركة اختبار',whatsappNumber:'07800000000',unifiedProcedureNo:'1234567890',attempts:1,requestedAt:new Date().toISOString(),review:{id:'review-test',state:'PROCEDURE_CREATED_WAITING_COMPLETION',decision:'finalize_and_complete',resolvedAt:new Date().toISOString(),metadata:{procedureNo:'1234567890'},screenshotMime:'image/png'}}}
function save(j=job()){store.set('tarabil:unified:job:'+j.id,JSON.stringify(j));store.set('tarabil:unified:review-shot:'+j.id+':'+j.review.id,'YWJj');return j}
async function prepare(j=job()){save(j);await wa.enqueueWhatsApp({},j);return j}
async function event(status='delivered',opts={}){
 const state=await wa.getWhatsAppDelivery({},jobId)
 const body={object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:opts.phone||'123'},statuses:[{id:opts.messageId||'wamid.test',status,biz_opaque_callback_data:jobId+':'+(opts.attempt||state.attempt)}]}}]}]}
 const raw=JSON.stringify(body)
 return {raw,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',cfg.whatsappAppSecret).update(raw).digest('hex')}}
}
beforeEach(()=>{store.clear();sent=[];mode='ok';mediaCount=0;onMessage=null;cfg.whatsappAccessToken='token-test'})
test('only approved completed execution can enqueue',async()=>{
 for(const change of [{status:'processing'},{kind:'test_navigation'},{cancelRequested:true},{statusCode:'TEST_SUCCESS'},{review:undefined},{whatsappNumber:''}]) await wa.enqueueWhatsApp({}, {...job(),...change})
 const wrong=job();wrong.review.metadata.procedureNo='another';await wa.enqueueWhatsApp({},wrong)
 assert.equal(store.size,0)
})
test('duplicate completion queues one notification and never a UI job',async()=>{
 const j=save();const e={headers:{authorization:'Bearer agent-test','x-tarabil-device-id':'test-device'},body:{id:j.id}}
 await complete(e);await complete(e)
 assert.equal(store.get('tarabil:whatsapp:queue:test-device').length,1)
 assert.equal(store.has('tarabil:unified:queue:test-device'),false)
})
test('missing configuration preserves queue without any Meta request',async()=>{
 await prepare();cfg.whatsappAccessToken=''
 assert.equal((await wa.dispatchWhatsApp({},'test-device')).configured,false)
 assert.equal(mediaCount,0);assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'queued')
})
test('send uses approved image and single template with procedure number and company',async()=>{
 await prepare();const result=await wa.dispatchWhatsApp({},'test-device')
 assert.equal(result.accepted,true);assert.equal(sent.length,1)
 assert.equal(sent[0].to,'9647800000000')
 assert.equal(sent[0].template.components[0].parameters[0].image.id,'image-test')
 assert.equal(sent[0].template.components[1].parameters[0].text,'1234567890')
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'accepted')
 await wa.dispatchWhatsApp({},'test-device');assert.equal(sent.length,1)
})
test('missing screenshot and invalid recipient do not send',async()=>{
 await prepare();store.delete('tarabil:unified:review-shot:'+jobId+':review-test')
 await wa.dispatchWhatsApp({},'test-device');assert.equal(sent.length,0)
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).errorCode,'approved_screenshot_missing')
 assert.throws(()=>wa.normalizeWhatsAppPhone('not-a-number'))
})
test('deleted job is skipped without sending',async()=>{
 await prepare();store.delete('tarabil:unified:job:'+jobId)
 await wa.dispatchWhatsApp({},'test-device');assert.equal(sent.length,0);assert.equal(mediaCount,0)
})
test('uncertain network result never automatically retries or changes completion',async()=>{
 await prepare();mode='timeout';await wa.dispatchWhatsApp({},'test-device');await wa.dispatchWhatsApp({},'test-device')
 assert.equal(sent.length,1)
 const state=await wa.getWhatsAppDelivery({},jobId);assert.equal(state.status,'unknown');assert.equal(state.errorCode,'delivery_uncertain')
 assert.equal(JSON.parse(store.get('tarabil:unified:job:'+jobId)).status,'done')
 await assert.rejects(()=>retry({headers:{'x-tarabil-mobile-pin':'pin-test'},params:{id:jobId}}),{statusCode:409})
})
test('definite Meta rejection can retry notification only',async()=>{
 await prepare();mode='metaFail';await wa.dispatchWhatsApp({},'test-device')
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).errorCode,'meta_132001')
 const before=store.get('tarabil:unified:job:'+jobId)
 await retry({headers:{'x-tarabil-mobile-pin':'pin-test'},params:{id:jobId}})
 assert.equal(store.get('tarabil:unified:job:'+jobId),before)
 mode='ok';await wa.dispatchWhatsApp({},'test-device');assert.equal(sent.length,2)
})
test('unsigned webhook is rejected',async()=>{
 await assert.rejects(()=>webhook({raw:'{}',headers:{}}),{statusCode:401})
})
test('webhook verify challenge requires matching token',()=>{
 assert.equal(verify({query:{'hub.mode':'subscribe','hub.verify_token':'verify-test','hub.challenge':'123'}}),'123')
 assert.throws(()=>verify({query:{'hub.mode':'subscribe','hub.verify_token':'bad'}}),{statusCode:403})
})
test('delivered and read statuses cannot regress on duplicate/out-of-order events',async()=>{
 await prepare();await wa.dispatchWhatsApp({},'test-device')
 await webhook(await event('read'));await webhook(await event('sent'));await webhook(await event('delivered'))
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'read')
})
test('webhook arriving before HTTP response is not overwritten',async()=>{
 await prepare();onMessage=async()=>webhook(await event('delivered'))
 await wa.dispatchWhatsApp({},'test-device')
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'delivered')
})
test('wrong sender, message or attempt cannot change delivery',async()=>{
 await prepare();await wa.dispatchWhatsApp({},'test-device')
 for(const opts of [{phone:'other'},{messageId:'other'},{attempt:'old-attempt'}])await webhook(await event('read',opts))
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'accepted')
})
test('signed delivery can resolve an uncertain send without another message',async()=>{
 await prepare();mode='timeout';await wa.dispatchWhatsApp({},'test-device')
 await webhook(await event('delivered'))
 assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'delivered');assert.equal(sent.length,1)
})
test('upload failure does not submit message and server failure is uncertain',async()=>{
 await prepare();mode='uploadFail';await wa.dispatchWhatsApp({},'test-device');assert.equal(sent.length,0)
 await retry({headers:{'x-tarabil-mobile-pin':'pin-test'},params:{id:jobId}})
 mode='serverFail';await wa.dispatchWhatsApp({},'test-device');assert.equal((await wa.getWhatsAppDelivery({},jobId)).status,'unknown')
})
