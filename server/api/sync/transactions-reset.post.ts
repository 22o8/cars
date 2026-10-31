import { redisCommand } from '../../utils/redis'
import { bumpRevision, transactionsHashKey } from '../../utils/sharedState'
export default defineEventHandler(async (event) => {
  await redisCommand(event, ['DEL', transactionsHashKey])
  const revision = await bumpRevision(event)
  return { ok: true, revision }
})
