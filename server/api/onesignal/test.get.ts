import { requireUser } from '../../utils/auth'
import { oneSignalConfigured, sendOneSignalToAll } from '../../utils/onesignal'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  if (!oneSignalConfigured()) {
    throw createError({ statusCode: 500, message: 'OneSignal غير مضبوط. أضف NUXT_PUBLIC_ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY في Vercel.' })
  }
  return sendOneSignalToAll(
    'اختبار إشعارات AutoDealer Pro',
    'إذا وصل هذا الإشعار فربط OneSignal يعمل بنجاح.',
    '/',
    `onesignal-manual-test-${Date.now()}`
  )
})
