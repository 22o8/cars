import { requireUser } from '../../utils/auth'
import { oneSignalConfigured, sendOneSignalToAll, sendOneSignalToUsers } from '../../utils/onesignal'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!oneSignalConfigured()) {
    throw createError({ statusCode: 500, message: 'OneSignal غير مضبوط. أضف NUXT_PUBLIC_ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY في Vercel.' })
  }

  // الاختبار يرسل لكل الأجهزة المشتركة حتى لا يفشل بسبب اختلاف external_id في OneSignal.
  // إذا أردت اختبار جهاز الموظف فقط: أضف ?strict=1 إلى الرابط.
  const strict = getQuery(event).strict === '1'
  if (strict) {
    return sendOneSignalToUsers(
      [user.id],
      'AutoDealer Pro',
      'تم تفعيل إشعارات الأقساط على هذا الجهاز بنجاح.',
      '/',
      `onesignal-test-user-${Date.now()}`
    )
  }

  return sendOneSignalToAll(
    'AutoDealer Pro',
    'تم تفعيل إشعارات الأقساط على هذا الجهاز بنجاح.',
    '/',
    `onesignal-test-all-${Date.now()}`
  )
})
