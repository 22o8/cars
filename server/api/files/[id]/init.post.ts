import { redisCommand } from '../../../utils/redis'
import { cloudFileMetaKey } from '../../../utils/cloudFiles'
export default defineEventHandler(async (event) => {
  const id = String(getRouterParam(event, 'id') || '')
  const body = await readBody(event)
  const size = Number(body?.size || 0), chunks = Number(body?.chunks || 0)
  if (!id || size < 0 || size > 50 * 1024 * 1024 || chunks < 0 || chunks > 400) throw createError({ statusCode: 400, statusMessage: 'بيانات الملف غير صالحة' })
  const meta = { id, mime: String(body?.mime || 'application/octet-stream').slice(0, 120), size, chunks, updatedAt: new Date().toISOString() }
  await redisCommand(event, ['SET', cloudFileMetaKey(id), JSON.stringify(meta)])
  return { ok: true, meta }
})
