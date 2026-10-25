import { getJson, setJson } from '../../../../utils/redis'
import { requireMobilePin } from '../../../../utils/security'
import { jobKey, type ReviewDecision, type UnifiedCloudJob } from '../../../../utils/unified'

const allowed = new Set<ReviewDecision>(['dismiss_and_resume', 'keep_and_stop', 'resume', 'stop', 'finalize_and_complete'])

export default defineEventHandler(async (event) => {
  requireMobilePin(event)
  const id = getRouterParam(event, 'id') || ''
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) throw createError({ statusCode: 404, statusMessage: 'الطلب غير موجود.' })
  if (!job.review?.id || job.status !== 'needs_review') throw createError({ statusCode: 409, statusMessage: 'لا يوجد قرار معلق لهذا الطلب.' })
  if (job.review.decision) throw createError({ statusCode: 409, statusMessage: 'تم إرسال قرار لهذا الطلب مسبقاً.' })
  const body = await readBody(event)
  const action = String(body?.action || '') as ReviewDecision
  if (!allowed.has(action)) throw createError({ statusCode: 400, statusMessage: 'قرار غير صالح.' })

  const now = new Date().toISOString()
  job.review.decision = action
  job.review.decisionAt = now
  if (action === 'stop' || action === 'keep_and_stop') {
    job.status = 'cancelled'
    job.cancelRequested = true
    job.cancelRequestedAt = now
    job.finishedAt = now
    job.statusCode = 'cancelled_by_user'
    job.message = action === 'keep_and_stop' ? 'تم إبقاء الشاشة الحالية وإيقاف الطلب.' : 'تم إيقاف الطلب بواسطة المستخدم.'
    job.error = ''
    job.review.resolvedAt = now
  } else {
    job.status = 'processing'
    job.statusCode = 'review_decision_received'
    job.message = action === 'dismiss_and_resume' ? 'تم إرسال أمر إغلاق الشاشة والمتابعة.' : action === 'finalize_and_complete' ? 'تمت الموافقة على إنجاز رقم الإجراء. جاري التأكيد على جهاز الأسيكودا.' : 'تم إرسال أمر المتابعة.'
  }
  await setJson(event, jobKey(id), job)
  return { ok: true, job }
})
