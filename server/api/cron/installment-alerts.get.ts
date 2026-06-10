import { sendDueInstallmentOneSignalAlerts } from '../../utils/onesignal'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = getHeader(event, 'authorization') || ''
    const q = getQuery(event).secret
    if (auth !== `Bearer ${secret}` && q !== secret) throw createError({ statusCode: 401, message: 'غير مصرح' })
  }
  return sendDueInstallmentOneSignalAlerts()
})
