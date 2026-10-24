import { redisCommand } from '../../../../utils/redis'
import { requireMobilePin } from '../../../../utils/security'
import { finalScreenshotKey, reviewScreenshotKey } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const query = getQuery(event)
  const reviewId = String(query.reviewId || '').trim()
  const mime = String(query.mime || 'image/jpeg')
  const key = reviewId ? reviewScreenshotKey(id, reviewId) : finalScreenshotKey(id)
  const raw = await redisCommand(event, ['GET', key])
  if (!raw) throw createError({ statusCode: 404, statusMessage: 'الصورة غير موجودة أو انتهت مدة حفظها.' })
  let buf: Buffer
  try { buf = Buffer.from(String(raw), 'base64') } catch { throw createError({ statusCode: 500, statusMessage: 'تعذر قراءة الصورة.' }) }
  setHeader(event, 'Content-Type', /^image\/(jpeg|png|webp)$/i.test(mime) ? mime : 'image/jpeg')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return buf
})
