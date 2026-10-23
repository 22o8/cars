import { requireMobilePin } from '../../utils/security'
export default defineEventHandler(event => {
 requireMobilePin(event)
 throw createError({ statusCode: 403, statusMessage: 'إنشاء إجراء حقيقي غير مفعّل أثناء اختبار النظام' })
})
