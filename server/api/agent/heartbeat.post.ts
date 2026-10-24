import { requireAgent } from '../../utils/security'
import { redisCommand } from '../../utils/redis'
import { agentSeenKey } from '../../utils/unified'
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const deviceId = requireAgent(event)
  const body = await readBody(event)
  const state = 'ONLINE'
  const version = String(body?.version || '').slice(0,80)
  const capabilities = Array.isArray(body?.capabilities) ? body.capabilities.map((x:any)=>String(x).slice(0,80)).slice(0,20) : []
  await redisCommand(event, ['SET', agentSeenKey(deviceId), new Date().toISOString(), 'EX', 180])
  await redisCommand(event, ['SET', `${agentSeenKey(deviceId)}:state`, state, 'EX', 180])
  await redisCommand(event, ['SET', `${agentSeenKey(deviceId)}:meta`, JSON.stringify({version,capabilities}), 'EX', 180])
  return { ok: true, version }
})
