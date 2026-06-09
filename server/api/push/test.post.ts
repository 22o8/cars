import { requireUser } from '../../utils/auth'
import { sendPushToUser, pushConfigured } from '../../utils/push'
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (!pushConfigured()) throw createError({ statusCode: 500, message: 'مفاتيح إشعارات Push غير مضبوطة في Vercel' })
  return sendPushToUser(user.id, { title: 'AutoDealer Pro', body: 'تم تفعيل إشعارات الجهاز بنجاح. ستصلك تنبيهات الأقساط حتى خارج البرنامج.', tag: `test-${Date.now()}`, url: '/' })
})
