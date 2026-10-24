import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createJiti } from 'jiti'
const jiti = createJiti(import.meta.url)
const store = new Map()
const config = {mobilePin:'test-only-pin',agentDeviceId:'test-device',agentDeviceToken:'test-only-token',redisUrl:'https://redis.invalid',redisToken:'test-only-redis'}
globalThis.defineEventHandler = handler => handler
globalThis.useRuntimeConfig = () => config
globalThis.getHeader = (event,key) => event.headers?.[key]
globalThis.setHeader = (event,key,value) => { (event.responseHeaders ||= {})[key] = value }
globalThis.readBody = async event => event.body
globalThis.getRouterParam = (event,key) => event.params?.[key]
globalThis.createError = data => Object.assign(new Error(data.statusMessage),data)
globalThis.fetch = async (url,options) => {
 assert.equal(url,config.redisUrl)
 const [cmd,key,...args]=JSON.parse(options.body)
 let result=null
 if(cmd==='SET'){store.set(key,String(args[0]));result='OK'}
 else if(cmd==='GET') result=store.get(key)||null
 else if(cmd==='LPUSH'){ const list=store.get(key)||[];list.unshift(...args);store.set(key,list);result=list.length }
 else if(cmd==='LTRIM'){store.set(key,(store.get(key)||[]).slice(Number(args[0]),Number(args[1])+1));result='OK'}
 else if(cmd==='LRANGE'){result=(store.get(key)||[]).slice(Number(args[0]),Number(args[1])+1)}
 else if(cmd==='LREM'){const list=store.get(key)||[];const value=String(args[1]);const next=list.filter(x=>String(x)!==value);result=list.length-next.length;store.set(key,next)}
 else if(cmd==='DEL'){result=store.delete(key)?1:0}
 else if(cmd==='PING') result='PONG'
 else throw Error('Unexpected command: '+cmd)
 return {ok:true,json:async()=>({result})}
}
const load=path=>jiti.import('../server/api/'+path,{default:true})
const testJob=await load('unified/test.post.ts')
const create=await load('unified/create.post.ts')
const complete=await load('agent/complete.post.ts')
const status=await load('unified/agent-status.get.ts')
const heartbeat=await load('agent/heartbeat.post.ts')
const retry=await load('unified/jobs/[id]/retry.post.ts')
const cancel=await load('unified/jobs/[id]/cancel.post.ts')
const del=await load('unified/jobs/[id]/delete.delete.ts')
const cancelAll=await load('unified/jobs/cancel-all.post.ts')
const clearAll=await load('unified/jobs/clear.delete.ts')
const control=await load('agent/jobs/[id]/control.get.ts')
const review=await load('agent/jobs/[id]/review.post.ts')
const reviewDecision=await load('unified/jobs/[id]/review-decision.post.ts')
const mobile=()=>({headers:{'x-tarabil-mobile-pin':config.mobilePin}})
const agent=body=>({headers:{authorization:'Bearer '+config.agentDeviceToken,'x-tarabil-device-id':config.agentDeviceId},body})
beforeEach(()=>store.clear())
test('test job requires no company or WhatsApp',async()=>{
 const {job}=await testJob(mobile())
 assert.equal(job.kind,'test_navigation');assert.equal(job.companyCode,'');assert.equal(job.whatsappNumber,'')
 assert.deepEqual(store.get('tarabil:unified:queue:test-device'),[job.id])
})
test('invalid PIN does not enqueue',async()=>{
 await assert.rejects(()=>testJob({headers:{}}),{statusCode:401});assert.equal(store.size,0)
})
test('production endpoint remains closed',async()=>{
 assert.throws(()=>create(mobile()),{statusCode:403});assert.equal(store.size,0)
})
test('completion requires screenshot and explicit success evidence',async()=>{
 const {job}=await testJob(mobile());job.status='processing';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 await assert.rejects(()=>complete(agent({id:job.id,ok:true})),{statusCode:400})
 const result=await complete(agent({id:job.id,ok:true,statusCode:'TEST_SUCCESS',screenshotTaken:true,screenshotName:'test.png'}))
 assert.equal(result.job.status,'done');assert.equal(result.job.statusCode,'TEST_SUCCESS')
 const duplicate=await complete(agent({id:job.id,ok:false,error:'late response'}));assert.equal(duplicate.job.status,'done')
})
test('heartbeat keeps device online and API is not cached',async()=>{
 await heartbeat(agent({state:'ONLINE'}));const event=mobile();const result=await status(event)
 assert.equal(result.state,'ONLINE');assert.match(event.responseHeaders['Cache-Control'],/no-store/)
})
test('job errors do not mark the device offline',async()=>{
 await heartbeat(agent({state:'AGENT_ERROR'}));assert.equal((await status(mobile())).state,'ONLINE')
})
test('completed test cannot be retried',async()=>{
 const {job}=await testJob(mobile());job.status='done';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 await assert.rejects(()=>retry({...mobile(),params:{id:job.id}}),{statusCode:409})
})


test('pending job can be stopped immediately',async()=>{
 const {job}=await testJob(mobile())
 const result=await cancel({...mobile(),params:{id:job.id}})
 assert.equal(result.job.status,'cancelled')
 assert.equal(result.job.cancelRequested,true)
 assert.deepEqual(store.get('tarabil:unified:queue:test-device'),[])
})
test('processing cancellation is visible to agent control endpoint',async()=>{
 const {job}=await testJob(mobile());job.status='processing';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 await cancel({...mobile(),params:{id:job.id}})
 const result=await control({...agent(),params:{id:job.id}})
 assert.equal(result.cancelRequested,true);assert.equal(result.status,'cancelled')
})
test('deleting a running job removes it and signals cancellation',async()=>{
 const {job}=await testJob(mobile());job.status='processing';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 await del({...mobile(),params:{id:job.id}})
 assert.equal(store.get('tarabil:unified:job:'+job.id),undefined)
 const result=await control({...agent(),params:{id:job.id}})
 assert.equal(result.cancelRequested,true);assert.equal(result.deleted,true)
})
test('cancel all stops queued jobs and clear all removes history',async()=>{
 const a=(await testJob(mobile())).job;const b=(await testJob(mobile())).job
 const stopped=await cancelAll(mobile());assert.equal(stopped.stopped,2)
 assert.equal(JSON.parse(store.get('tarabil:unified:job:'+a.id)).status,'cancelled')
 const cleared=await clearAll(mobile());assert.equal(cleared.deleted,2)
 assert.equal(store.get('tarabil:unified:recent').length,0)
})

test('unexpected ASYCUDA screen pauses job for interactive review',async()=>{
 const {job}=await testJob(mobile());job.status='processing';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 const res=await review({...agent({state:'PREDECLARATION_OPEN',title:'يوجد بيان مسبق مفتوح',message:'راجع الصورة',screenshotMime:'image/jpeg',screenshotBase64:'YWJj'}),params:{id:job.id}})
 assert.equal(res.review.state,'PREDECLARATION_OPEN')
 const saved=JSON.parse(store.get('tarabil:unified:job:'+job.id));assert.equal(saved.status,'needs_review');assert.equal(saved.review.screenshotAvailable,true)
 const ctl=await control({...agent(),params:{id:job.id}});assert.equal(ctl.status,'needs_review');assert.equal(ctl.review.id,res.review.id)
})
test('review decision resumes the same running job',async()=>{
 const {job}=await testJob(mobile());job.status='processing';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 const paused=await review({...agent({state:'NOTIFICATIONS_POPUP',title:'اشعارات',message:'review',screenshotMime:'image/jpeg',screenshotBase64:'YWJj'}),params:{id:job.id}})
 const decided=await reviewDecision({...mobile(),params:{id:job.id},body:{action:'dismiss_and_resume'}})
 assert.equal(decided.job.status,'processing');assert.equal(decided.job.review.decision,'dismiss_and_resume')
 const ctl=await control({...agent(),params:{id:job.id}});assert.equal(ctl.review.decision,'dismiss_and_resume');assert.equal(ctl.cancelRequested,false)
})
test('keep-and-stop decision cancels the job',async()=>{
 const {job}=await testJob(mobile());job.status='processing';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 await review({...agent({state:'DECLARATION_OPEN',title:'بيان',message:'review',screenshotMime:'image/jpeg',screenshotBase64:'YWJj'}),params:{id:job.id}})
 const decided=await reviewDecision({...mobile(),params:{id:job.id},body:{action:'keep_and_stop'}})
 assert.equal(decided.job.status,'cancelled');assert.equal(decided.job.cancelRequested,true)
})
