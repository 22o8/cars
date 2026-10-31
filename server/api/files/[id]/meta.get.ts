import { redisCommand } from '../../../utils/redis'
import { cloudFileMetaKey } from '../../../utils/cloudFiles'
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  const raw = await redisCommand(event, ['GET', cloudFileMetaKey(id)])
  if (!raw) throw createError({ statusCode: 404, statusMessage: 'الملف غير موجود سحابياً' })
  try { return JSON.parse(String(raw)) } catch { throw createError({ statusCode: 500, statusMessage: 'بيانات الملف تالفة' }) }
})
