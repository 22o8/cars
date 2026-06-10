import { requireUser } from '../../utils/auth'
import { oneSignalConfigured, sendOneSignalToUsers } from '../../utils/onesignal'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!oneSignalConfigured()) {
    throw createError({ statusCode: 500, message: 'OneSignal غير مضبوط. أضف NUXT_PUBLIC_ONESIGNAL_APP_ID و ONESIGNAL_REST_API_KEY في Vercel.' })
  }
  return sendOneSignalToUsers(
    [user.id],
    'AutoDealer Pro',
    'تم تفعيل إشعارات الأقساط على هذا الجهاز بنجاح.',
    '/',
    `onesignal-test-${Date.now()}`
  )
})
