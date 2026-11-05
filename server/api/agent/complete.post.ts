import { getJson, redisCommand, setJson } from '../../utils/redis'
import { requireAgent } from '../../utils/security'
import { finalScreenshotKey, jobKey, recentKey, type UnifiedCloudJob } from '../../utils/unified'

export default defineEventHandler(async (event) => {
  const deviceId = requireAgent(event)
  const body = await readBody(event)
  const id = String(body?.id || '').trim()
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing job id' })
  const job = await getJson<UnifiedCloudJob>(event, jobKey(id))
  if (!job) return { ok: true, deleted: true }
  if (job.deviceId !== deviceId) throw createError({ statusCode: 403, statusMessage: 'wrong device' })
  // Recover only the known false failure after an operator-approved completion.
  // This never enqueues a job or repeats an ASYCUDA action.
  const recovering = body?.recoverCompleted === true
  if (recovering && job.status !== 'done') {
    const receipt = body?.completionReceipt
    const expectedNumber = String(job.review?.metadata?.procedureNo || '')
    if (job.status !== 'failed' || job.statusCode !== 'completion_identity_changed' || job.cancelRequested ||
        job.review?.state !== 'PROCEDURE_CREATED_WAITING_COMPLETION' || job.review.decision !== 'finalize_and_complete' ||
        !job.review.resolvedAt || !expectedNumber || body?.unifiedProcedureNo !== expectedNumber ||
        body?.reviewId !== job.review.id || body?.ok !== true || body?.statusCode !== 'PROCEDURE_COMPLETED' ||
        receipt?.procedureNo !== expectedNumber || receipt?.serverSuccess !== true || receipt?.confirmationClicked !== true ||
        receipt?.dialogClosed !== true || receipt?.hwnd !== job.review.metadata?.target?.windowHwnd ||
        body?.screenshotTaken !== true || !body?.screenshotBase64 || body.screenshotBase64.length > 4_000_000 ||
        !/^image\/(jpeg|png|webp)$/i.test(String(body?.screenshotMime || ''))) {
      throw createError({ statusCode: 409, statusMessage: 'verified completion recovery evidence required' })
    }
    job.completionRecovery = { previousStatusCode: job.statusCode, reviewId: job.review.id, recoveredAt: new Date().toISOString() }
  }
  if (job.status === 'done') return { ok: true, job }
  if ( job.status === 'cancelled' || (job.status === 'failed' && !recovering)) return { ok: true, job }
  if (!recovering && !['processing', 'needs_review', 'cancelling'].includes(job.status)) throw createError({ statusCode: 409, statusMessage: 'job is not processing' })

  const statusCode = String(body?.statusCode || '').slice(0, 80)
  const cancelled = statusCode === 'cancelled_by_user' || job.cancelRequested === true

  if (!cancelled && body?.ok && ['test','test_navigation'].includes(job.kind) && (statusCode !== 'TEST_SUCCESS' || body?.screenshotTaken !== true)) {
    throw createError({ statusCode: 400, statusMessage: 'navigation proof missing' })
  }

  if (!cancelled && body?.ok && job.kind === 'close_asycuda' && statusCode !== 'ASYCUDA_CLOSED') throw createError({statusCode:400,statusMessage:'close confirmation missing'})

  job.statusCode = cancelled ? 'cancelled_by_user' : statusCode
  job.message = cancelled ? 'تم إيقاف الطلب بواسطة المستخدم.' : String(body?.message || '').slice(0, 300)
  job.status = cancelled ? 'cancelled' : (body?.ok === true ? 'done' : 'failed')
  job.finishedAt = new Date().toISOString()
  job.unifiedProcedureNo = cancelled ? '' : String(body?.unifiedProcedureNo || '').trim()
  job.screenshotTaken = !!body?.screenshotTaken
  job.screenshotName = String(body?.screenshotName || '').trim()
  const shotData = String(body?.screenshotBase64 || '')
  const shotMime = String(body?.screenshotMime || 'image/jpeg')
  if (shotData && shotData.length <= 4_000_000 && /^image\/(jpeg|png|webp)$/i.test(shotMime)) {
    await redisCommand(event, ['SET', finalScreenshotKey(id), shotData, 'EX', 604800])
    job.screenshotMime = shotMime
    job.screenshotAvailable = true
  }
  job.error = cancelled ? '' : (body?.ok ? '' : String(body?.error || 'فشل التنفيذ على جهاز الأسيكودا'))

  if (job.deleteAfterCancel) {
    await redisCommand(event, ['LREM', recentKey, 0, id])
    await redisCommand(event, ['DEL', jobKey(id)])
    return { ok: true, deleted: true }
  }

  await setJson(event, jobKey(id), job)
  return { ok: true, job }
})
