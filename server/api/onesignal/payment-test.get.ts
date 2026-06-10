import { requireUser } from '../../utils/auth'
import { oneSignalConfigured, sendInstallmentPaidOneSignalAlert } from '../../utils/onesignal'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  if (!oneSignalConfigured()) {
    throw createError({ statusCode: 500, message: 'OneSignal غير مضبوط في متغيرات Vercel.' })
  }

  return sendInstallmentPaidOneSignalAlert({
    installmentId: `manual-test-${Date.now()}`,
    installmentNumber: 'اختبار',
    customerName: 'اختبار النظام',
    carName: 'AutoDealer Pro',
    amount: 1000,
    currency: 'IQD',
    fullyPaid: true
  })
})
