import { prisma } from './db'

export function oneSignalConfigured() {
  return Boolean(process.env.NUXT_PUBLIC_ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY)
}

export function oneSignalAppId() {
  return process.env.NUXT_PUBLIC_ONESIGNAL_APP_ID || ''
}

export function installmentAlertRepeatMinutes() {
  // مكان تعديل مدة تكرار إشعار القسط:
  // غيّر INSTALLMENT_ALERT_REPEAT_MINUTES في Vercel Environment Variables.
  // القيمة الافتراضية: 5 دقائق.
  const value = Number(process.env.INSTALLMENT_ALERT_REPEAT_MINUTES || 5)
  if (!Number.isFinite(value) || value < 1) return 5
  return Math.floor(value)
}

async function sendOneSignalNotification(payload: any) {
  if (!oneSignalConfigured()) return { ok: false, sent: 0, failed: 0, reason: 'not-configured' }

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: process.env.NUXT_PUBLIC_ONESIGNAL_APP_ID,
      ...payload
    })
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, sent: 0, failed: 1, status: res.status, data }

  const recipients = Number(data?.recipients || 0)
  return { ok: true, sent: recipients, failed: 0, data }
}

export async function sendOneSignalToUsers(userIds: string[], title: string, body: string, url = '/', tag?: string) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return { ok: true, sent: 0, failed: 0, skipped: true }

  return sendOneSignalNotification({
    include_external_user_ids: ids,
    channel_for_external_user_ids: 'push',
    headings: { en: title, ar: title },
    contents: { en: body, ar: body },
    url,
    web_url: url,
    chrome_web_icon: '/icons/icon-192.svg',
    chrome_web_badge: '/icons/icon-192.svg',
    priority: 10,
    ttl: 3600,
    collapse_id: tag,
    data: { url, tag }
  })
}

export async function sendOneSignalToAll(title: string, body: string, url = '/', tag?: string) {
  return sendOneSignalNotification({
    included_segments: ['Subscribed Users'],
    headings: { en: title, ar: title },
    contents: { en: body, ar: body },
    url,
    web_url: url,
    chrome_web_icon: '/icons/icon-192.svg',
    chrome_web_badge: '/icons/icon-192.svg',
    priority: 10,
    ttl: 3600,
    collapse_id: tag,
    data: { url, tag }
  })
}

export async function sendDueInstallmentOneSignalAlerts() {
  const now = new Date()
  const repeatMinutes = installmentAlertRepeatMinutes()
  const repeatMs = repeatMinutes * 60 * 1000
  const bucket = Math.floor(now.getTime() / repeatMs)

  const keepDays = Number(process.env.NOTIFICATION_DELIVERY_KEEP_DAYS || 30)
  if (Number.isFinite(keepDays) && keepDays > 0) {
    const cutoff = new Date(now.getTime() - keepDays * 24 * 60 * 60 * 1000)
    await prisma.notificationDelivery.deleteMany({ where: { sentAt: { lt: cutoff } } }).catch(() => null)
  }

  const installments = await prisma.installment.findMany({
    where: { status: { not: 'PAID' }, dueDate: { lte: now } },
    include: { sale: { include: { customer: true, car: true } } },
    orderBy: { dueDate: 'asc' }
  })

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, role: true, permissions: true }
  })

  // كل المديرين والمحاسبين وأي مستخدم عنده صلاحية الأقساط يستلم التنبيه.
  const targetUsers = users.filter((u: any) =>
    u.role === 'ADMIN' ||
    u.role === 'ACCOUNTANT' ||
    (Array.isArray(u.permissions) && u.permissions.includes('installments'))
  )

  let checked = 0
  let sent = 0
  let failed = 0
  let skipped = 0

  for (const i of installments) {
    const remaining = Math.max(0, Number(i.amount) - Number(i.paidAmount))
    const dueDate = i.dueDate.toLocaleDateString('ar-IQ')
    const tag = `onesignal-installment-due-${i.id}-${bucket}`
    const title = 'تنبيه موعد تسديد قسط'
    const body = `${i.sale.customer.fullName} - ${i.sale.car.brand} ${i.sale.car.model} - المتبقي ${remaining.toLocaleString('en-US')} - الاستحقاق ${dueDate}`

    const userIds: string[] = []
    for (const user of targetUsers) {
      const exists = await prisma.notificationDelivery.findUnique({ where: { userId_tag: { userId: user.id, tag } } }).catch(() => null)
      if (exists) { skipped++; continue }
      userIds.push(user.id)
      checked++
    }

    if (!userIds.length) continue

    const result = process.env.ONESIGNAL_SEND_TO_ALL === 'true'
      ? await sendOneSignalToAll(title, body, '/installments', tag)
      : await sendOneSignalToUsers(userIds, title, body, '/installments', tag)

    sent += result.sent || 0
    failed += result.failed || 0

    for (const userId of userIds) {
      await prisma.notificationDelivery.create({
        data: { userId, title, body, tag, installmentId: i.id }
      }).catch(() => null)
    }
  }

  return {
    provider: 'onesignal',
    configured: oneSignalConfigured(),
    repeatMinutes,
    installments: installments.length,
    users: targetUsers.length,
    checked,
    skipped,
    sent,
    failed
  }
}
