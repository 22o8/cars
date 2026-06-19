import { sendDueInstallmentOneSignalAlerts, sendDuePurchaseOneSignalAlerts } from '../../utils/onesignal'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = getHeader(event, 'authorization') || ''
    const q = getQuery(event).secret
    if (auth !== `Bearer ${secret}` && q !== secret) throw createError({ statusCode: 401, message: 'غير مصرح' })
  }

  const sales = await sendDueInstallmentOneSignalAlerts()
  const purchases = await sendDuePurchaseOneSignalAlerts()

  return {
    ok: true,
    provider: 'onesignal',
    sales,
    purchases,
    sent: Number(sales?.sent || 0) + Number(purchases?.sent || 0),
    failed: Number(sales?.failed || 0) + Number(purchases?.failed || 0)
  }
})
