import { randomUUID } from 'node:crypto'
import { getJson, redisCommand, setJson } from '../../../../utils/redis'
import { requireAgent } from '../../../../utils/security'
import { jobKey, reviewScreenshotKey, type UnifiedCloudJob, type UnifiedReview } from '../../../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'job not found' })
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  if (!['processing', 'needs_review'].includes(job.status)) {
    throw createError({ statusCode: 409, statusMessage: 'job is not active' })
  }

  const body = await readBody(event)
  const state = String(body?.state || 'UNKNOWN').slice(0, 80)
  const title = String(body?.title || 'تحتاج العملية إلى قرار').slice(0, 160)
  const message = String(body?.message || '').slice(0, 1000)
  const mime = String(body?.screenshotMime || 'image/jpeg').slice(0, 80)
  const data = String(body?.screenshotBase64 || '')
  if (!/^image\/(jpeg|png|webp)$/i.test(mime)) throw createError({ statusCode: 400, statusMessage: 'unsupported image type' })
  if (!data || data.length > 4_000_000) throw createError({ statusCode: 400, statusMessage: 'review screenshot missing or too large' })

  if (job.review?.id) {
    const previous = { ...job.review }
    job.reviewHistory = [...(job.reviewHistory || []), previous].slice(-12)
  }

  const review: UnifiedReview = {
    id: randomUUID(),
    state,
    title,
    message,
    createdAt: new Date().toISOString(),
    screenshotMime: mime,
    screenshotAvailable: true
  }
  await redisCommand(event, ['SET', reviewScreenshotKey(id, review.id), data, 'EX', 604800])
  job.review = review
  job.status = 'needs_review'
  job.statusCode = 'needs_review'
  job.message = 'بانتظار قرار المستخدم.'
  job.error = ''
  await setJson(event, jobKey(id), job)
  return { ok: true, review }
})
