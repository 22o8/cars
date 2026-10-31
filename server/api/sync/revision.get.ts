import { redisCommand } from '../../utils/redis'
import { revisionKey } from '../../utils/sharedState'
export default defineEventHandler(async (event) => ({ revision: Number(await redisCommand(event, ['GET', revisionKey]) || 0) }))
