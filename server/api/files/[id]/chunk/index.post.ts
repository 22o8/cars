import { redisCommand } from '../../../../utils/redis'
import { cloudFileChunkKey } from '../../../../utils/cloudFiles'
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  const body = await readBody(event)
  const index = Number(body?.index)
  const data = String(body?.data || '')
  if (!id || !Number.isInteger(index) || index < 0 || index > 399 || data.length > 500_000) throw createError({ statusCode: 400, statusMessage: 'جزء الملف غير صالح' })
  await redisCommand(event, ['SET', cloudFileChunkKey(id, index), data])
  return { ok: true }
})
