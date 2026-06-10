import { prisma } from './db'

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || ''
}

async function webPush() {
  const mod: any = await import('web-push')
  const wp = mod.default || mod
  if (!pushConfigured()) return null
  wp.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  return wp
}

export async function sendPushToUser(userId: string, payload: any) {
  const wp = await webPush()
  if (!wp) return { sent: 0, failed: 0, configured: false }
  const subs = await prisma.pushSubscription.findMany({ where: { userId, active: true } })
  let sent = 0
  let failed = 0
  for (const s of subs) {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload))
      sent++
    } catch (e: any) {
      failed++
      const code = e?.statusCode || e?.status
      if (code === 404 || code === 410) await prisma.pushSubscription.update({ where: { id: s.id }, data: { active: false } }).catch(() => null)
    }
  }
  return { sent, failed, configured: true }
}

export function installmentAlertRepeatMinutes() {
  // غيّر قيمة INSTALLMENT_ALERT_REPEAT_MINUTES في Vercel أو .env لتعديل مدة تكرار إرسال إشعار القسط.
  // القيمة الافتراضية حالياً: كل 5 دقائق.
  const value = Number(process.env.INSTALLMENT_ALERT_REPEAT_MINUTES || 5)
  if (!Number.isFinite(value) || value < 1) return 5
  return Math.floor(value)
}

export async function sendDueInstallmentPushes() {
  const now = new Date()
  const repeatMinutes = installmentAlertRepeatMinutes()
  const repeatMs = repeatMinutes * 60 * 1000
  const bucket = Math.floor(now.getTime() / repeatMs)

  // تنظيف قديم حتى لا يكبر سجل الإشعارات بلا داعي.
  const keepDays = Number(process.env.NOTIFICATION_DELIVERY_KEEP_DAYS || 30)
  if (Number.isFinite(keepDays) && keepDays > 0) {
    const cutoff = new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000)
    await prisma.notificationDelivery.deleteMany({ where: { sentAt: { lt: cutoff } } }).catch(() => null)
  }

  const installments = await prisma.installment.findMany({
    where: { status: { not: 'PAID' }, dueDate: { lte: now } },
    include: { sale: { include: { customer: true, car: true, soldBy: true } } },
    orderBy: { dueDate: 'asc' }
  })

  const users = await prisma.user.findMany({ where: { active: true } })
  let checked = 0
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const i of installments) {
    const remaining = Math.max(0, Number(i.amount) - Number(i.paidAmount))
    const dueDate = i.dueDate.toLocaleDateString('ar-IQ')
    // هذا الـ tag يتغير كل فترة تكرار، لذلك نفس القسط يعاد تنبيهه كل 5 دقائق افتراضياً.
    const tag = `installment-due-${i.id}-${bucket}`

    for (const user of users) {
      const exists = await prisma.notificationDelivery.findUnique({ where: { userId_tag: { userId: user.id, tag } } }).catch(() => null)
      if (exists) { skipped++; continue }
      checked++

      const title = 'تنبيه موعد تسديد قسط'
      const body = `${i.sale.customer.fullName} - ${i.sale.car.brand} ${i.sale.car.model} - المتبقي ${remaining.toLocaleString('en-US')} - الاستحقاق ${dueDate}`
      const result = await sendPushToUser(user.id, {
        title,
        body,
        tag,
        url: '/installments',
        requireInteraction: true,
        timestamp: now.toISOString()
      })
      sent += result.sent
      failed += result.failed

      // حتى إذا لم توجد أجهزة مشتركة، نسجل محاولة الإرسال حتى لا يكرر نفس الـ cron داخل نفس فترة الخمس دقائق.
      await prisma.notificationDelivery.create({
        data: { userId: user.id, title, body, tag, installmentId: i.id }
      }).catch(() => null)
    }
  }
  return { installments: installments.length, users: users.length, checked, skipped, sent, failed, configured: pushConfigured(), repeatMinutes }
}
