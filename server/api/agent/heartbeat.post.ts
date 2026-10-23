import { requireAgent } from '../../utils/security'
import { redisCommand } from '../../utils/redis'
import { agentSeenKey } from '../../utils/unified'
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const deviceId = requireAgent(event)
  const body = await readBody(event)
  const state = body?.state === 'AGENT_ERROR' ? 'AGENT_ERROR' : 'ONLINE'
  await redisCommand(event, ['SET', agentSeenKey(deviceId), new Date().toISOString(), 'EX', 180])
  await redisCommand(event, ['SET', `${agentSeenKey(deviceId)}:state`, state, 'EX', 180])
  return { ok: true }
})
