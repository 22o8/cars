import { requireAgent } from '../../utils/security'
import { redisCommand } from '../../utils/redis'
export default defineEventHandler(async event => {
 setHeader(event, 'Cache-Control', 'no-store')
 requireAgent(event)
 await redisCommand(event, ['PING'])
 return { ok: true }
})
