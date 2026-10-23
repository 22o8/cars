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
test('agent error is not mislabeled offline',async()=>{
 await heartbeat(agent({state:'AGENT_ERROR'}));assert.equal((await status(mobile())).state,'AGENT_ERROR')
})
test('completed test cannot be retried',async()=>{
 const {job}=await testJob(mobile());job.status='done';store.set('tarabil:unified:job:'+job.id,JSON.stringify(job))
 await assert.rejects(()=>retry({...mobile(),params:{id:job.id}}),{statusCode:409})
})

