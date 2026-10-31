import { redisCommand } from '../../../../utils/redis'
import { cloudFileChunkKey } from '../../../../utils/cloudFiles'
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  const index = Number(getRouterParam(event, 'index'))
  if (!id || !Number.isInteger(index) || index < 0) throw createError({ statusCode: 400, statusMessage: 'طلب غير صالح' })
  const data = await redisCommand(event, ['GET', cloudFileChunkKey(id, index)])
  if (data == null) throw createError({ statusCode: 404, statusMessage: 'جزء الملف غير موجود' })
  return { data: String(data) }
})
