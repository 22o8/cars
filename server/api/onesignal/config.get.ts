import { oneSignalAppId, oneSignalConfigured, oneSignalKeyStatus, installmentAlertRepeatMinutes } from '../../utils/onesignal'

export default defineEventHandler(async () => ({
  provider: 'onesignal',
  appId: oneSignalAppId(),
  configured: oneSignalConfigured(),
  repeatMinutes: installmentAlertRepeatMinutes(),
  key: oneSignalKeyStatus(),
  note: 'إذا restKeySet=true و configured=true فالقيم موجودة. إذا الإرسال يرجع 403 فالمفتاح نفسه خطأ أو ليس REST API Key الكامل.'
}))
