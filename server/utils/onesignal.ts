import { prisma } from './db'

function env(name: string) {
  return String(process.env[name] || '').trim().replace(/^[\'\"]|[\'\"]$/g, '')
}

function siteUrl(path = '/') {
  const base = (env('NUXT_PUBLIC_SITE_URL') || 'https://cars-wa9g.vercel.app').replace(/\/$/, '')
  if (!path || path === '/') return `${base}/`
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function oneSignalConfigured() {
  return Boolean(env('NUXT_PUBLIC_ONESIGNAL_APP_ID') && env('ONESIGNAL_REST_API_KEY'))
}

export function oneSignalAppId() {
  return env('NUXT_PUBLIC_ONESIGNAL_APP_ID')
}

export function oneSignalKeyStatus() {
  const key = env('ONESIGNAL_REST_API_KEY')
  return {
    appIdSet: Boolean(oneSignalAppId()),
    restKeySet: Boolean(key),
    restKeyPrefix: key ? `${key.slice(0, 10)}...` : '',
    restKeyLength: key.length
  }
}

export function installmentAlertRepeatMinutes() {
  // مكان تعديل مدة تكرار إشعار القسط:
  // غيّر INSTALLMENT_ALERT_REPEAT_MINUTES في Vercel Environment Variables.
  // للإنتاج اليومي على Vercel Hobby استخدم 1440 حتى يكرر التنبيه مرة كل يوم.
  const value = Number(env('INSTALLMENT_ALERT_REPEAT_MINUTES') || 1440)
  if (!Number.isFinite(value) || value < 1) return 1440
  return Math.floor(value)
}

function oneSignalAuthHeaders() {
  const key = env('ONESIGNAL_REST_API_KEY')
  // OneSignal REST API v2 يستعمل Key. نترك Basic كاحتياط لبعض المفاتيح القديمة.
  return key.startsWith('os_v2_') ? [`Key ${key}`, `Basic ${key}`] : [`Basic ${key}`, `Key ${key}`]
}

function buildPayload(payload: any) {
  const clickUrl = siteUrl(payload.web_url || payload.app_url || payload.url || '/')
  const { url, app_url, web_url, ...cleanPayload } = payload || {}

  return {
    app_id: oneSignalAppId(),
    target_channel: 'push',
    ...cleanPayload,
    // لا نرسل url مع web_url حتى لا يرجع OneSignal خطأ:
    // Remove url field when setting app_url or web_url.
    web_url: clickUrl
  }
}

async function sendOneSignalNotification(payload: any) {
  if (!oneSignalConfigured()) return { ok: false, sent: 0, failed: 0, reason: 'not-configured' }

  const body = buildPayload(payload)
  let last: any = null

  for (const authorization of oneSignalAuthHeaders()) {
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: authorization
      },
      body: JSON.stringify(body)
    })

    const data = await res.json().catch(() => ({}))
    const errors = Array.isArray(data?.errors) ? data.errors : []
    const recipients = Number(data?.recipients || 0)
    last = { status: res.status, data }

    // OneSignal قد يرجع id بدون recipients، أو يرجع id مع external_id=null.
    // طالما الطلب مقبول وفيه id نعتبره أُرسل حتى لا تبقى sent = 0 رغم وصول الإشعار.
    if (res.ok && data?.id) {
      return { ok: true, sent: recipients > 0 ? recipients : 1, failed: 0, status: res.status, data }
    }

    if (res.ok && !errors.length && recipients > 0) {
      return { ok: true, sent: recipients, failed: 0, status: res.status, data }
    }

    // إذا قبل OneSignal الطلب ولكن بدون مستلمين أو مع خطأ في الجمهور، نرجعها واضحة.
    if (res.ok || ![401, 403].includes(res.status)) break
  }

  return {
    ok: false,
    sent: 0,
    failed: 1,
    status: last?.status,
    data: last?.data,
    hint: 'تأكد أن الجهاز Subscribed داخل OneSignal وأن Segment المستخدم موجود.'
  }
}

async function sendOneSignalNotificationWithFallback(payloads: any[]) {
  const attempts: any[] = []
  for (const payload of payloads) {
    const result: any = await sendOneSignalNotification(payload)
    attempts.push({ audience: payload.included_segments || payload.include_aliases || payload.include_subscription_ids || payload.filters, result })
    if (result.ok && (result.sent || 0) > 0) return { ...result, attempts }
  }
  const last = attempts[attempts.length - 1]?.result || { ok: false, sent: 0, failed: 1 }
  return { ...last, attempts }
}

function notificationBase(title: string, body: string, path = '/', tag?: string) {
  const clickUrl = siteUrl(path)
  return {
    headings: { en: title, ar: title },
    contents: { en: body, ar: body },
    web_url: clickUrl,
    chrome_web_icon: '/icons/icon-192.svg',
    chrome_web_badge: '/icons/icon-192.svg',
    priority: 10,
    ttl: 3600,
    collapse_id: tag,
    // لا تستخدم data.url لأن OneSignal قد يرفض الطلب عند وجود web_url.
    data: { clickUrl, tag }
  }
}

export async function sendOneSignalToUsers(userIds: string[], title: string, body: string, path = '/', tag?: string) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return { ok: true, sent: 0, failed: 0, skipped: true }

  return sendOneSignalNotification({
    include_aliases: { external_id: ids },
    ...notificationBase(title, body, path, tag)
  })
}

export async function sendOneSignalToAll(title: string, body: string, path = '/', tag?: string) {
  const basePayload = notificationBase(title, body, path, tag)

  return sendOneSignalNotificationWithFallback([
    { ...basePayload, included_segments: ['Total Subscriptions'] },
    { ...basePayload, included_segments: ['Subscribed Users'] },
    { ...basePayload, included_segments: ['All'] }
  ])
}

async function sendWithFallbackToAll(userIds: string[], title: string, body: string, path: string, tag: string) {
  // افتراضياً نرسل لكل الأجهزة المشتركة لأن جهاز المدير قد لا يكون مربوطاً بنفس id قاعدة البيانات.
  if (env('ONESIGNAL_STRICT_USER_TARGETING') !== 'true') return sendOneSignalToAll(title, body, path, tag)

  const byUser = await sendOneSignalToUsers(userIds, title, body, path, tag)
  if ((byUser.sent || 0) > 0 || byUser.failed) return byUser

  if (env('ONESIGNAL_FALLBACK_TO_ALL') !== 'false') return sendOneSignalToAll(title, body, path, `${tag}-all`)
  return byUser
}

export async function sendInstallmentPaidOneSignalAlert(info: {
  installmentId: string
  installmentNumber?: number | string
  customerName: string
  carName: string
  amount: number
  currency: string
  fullyPaid: boolean
}) {
  const amount = Number(info.amount || 0).toLocaleString('en-US')
  const title = info.fullyPaid ? 'تم تسديد قسط بالكامل' : 'تم تسجيل دفعة على قسط'
  const body = `${info.customerName} - ${info.carName} - المبلغ ${amount} ${info.currency}`
  return sendOneSignalToAll(title, body, '/installments', `onesignal-installment-paid-${info.installmentId}-${Date.now()}`)
}


export async function sendPurchasePaidOneSignalAlert(info: {
  purchaseId: string
  sellerName: string
  carName: string
  amount: number
  currency: string
  fullyPaid: boolean
}) {
  const amount = Number(info.amount || 0).toLocaleString('en-US')
  const title = info.fullyPaid ? 'تم تسديد دفعة شراء بالكامل' : 'تم تسجيل دفعة شراء'
  const body = `${info.sellerName} - ${info.carName} - المبلغ ${amount} ${info.currency}`
  return sendOneSignalToAll(title, body, '/records', `onesignal-purchase-paid-${info.purchaseId}-${Date.now()}`)
}

export async function sendDuePurchaseOneSignalAlerts() {
  const now = new Date()
  const repeatMinutes = installmentAlertRepeatMinutes()
  const repeatMs = repeatMinutes * 60 * 1000
  const bucket = Math.floor(now.getTime() / repeatMs)

  const purchases = await prisma.purchase.findMany({
    where: { remainingAmount: { gt: 0 }, dueDate: { lte: now } },
    orderBy: { dueDate: 'asc' }
  }).catch(() => [])

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, username: true, role: true, permissions: true }
  })

  const targetUsers = users.filter((u: any) =>
    u.role === 'ADMIN' ||
    u.role === 'ACCOUNTANT' ||
    (Array.isArray(u.permissions) && (u.permissions.includes('purchases') || u.permissions.includes('accounts')))
  )

  let checked = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  const details: any[] = []

  for (const p of purchases as any[]) {
    const remaining = Number(p.remainingAmount || 0)
    const dueDate = p.dueDate ? new Date(p.dueDate).toLocaleDateString('ar-IQ') : '-'
    const tag = `onesignal-purchase-due-${p.id}-${bucket}`
    const title = 'تنبيه دفعة شراء مستحقة أو متأخرة'
    const body = `${p.sellerName} - ${p.carName} - المتبقي ${remaining.toLocaleString('en-US')} ${p.currency} - الاستحقاق ${dueDate}`

    const userIds: string[] = []
    for (const user of targetUsers as any[]) {
      const exists = await prisma.notificationDelivery.findUnique({ where: { userId_tag: { userId: user.id, tag } } }).catch(() => null)
      if (exists) { skipped++; continue }
      userIds.push(user.id)
      checked++
    }

    if (!userIds.length) continue

    const result = await sendWithFallbackToAll(userIds, title, body, '/records', tag)
    sent += result.sent || 0
    failed += result.failed || 0
    details.push({ purchaseId: p.id, seller: p.sellerName, sent: result.sent || 0, ok: result.ok, status: result.status, data: result.data })

    if (result.ok) {
      for (const userId of userIds) {
        await prisma.notificationDelivery.create({
          data: { userId, title, body, tag, installmentId: null }
        }).catch(() => null)
      }
    }
  }

  return { purchases: purchases.length, users: targetUsers.length, checked, skipped, sent, failed, details }
}

export async function sendDueInstallmentOneSignalAlerts() {
  const now = new Date()
  const repeatMinutes = installmentAlertRepeatMinutes()
  const repeatMs = repeatMinutes * 60 * 1000
  const bucket = Math.floor(now.getTime() / repeatMs)

  const keepDays = Number(env('NOTIFICATION_DELIVERY_KEEP_DAYS') || 30)
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
    select: { id: true, username: true, role: true, permissions: true }
  })

  const targetUsers = users.filter((u: any) =>
    u.role === 'ADMIN' ||
    u.role === 'ACCOUNTANT' ||
    (Array.isArray(u.permissions) && u.permissions.includes('installments'))
  )

  let checked = 0
  let sent = 0
  let failed = 0
  let skipped = 0
  const details: any[] = []

  for (const i of installments) {
    const remaining = Math.max(0, Number(i.amount) - Number(i.paidAmount))
    const dueDate = i.dueDate.toLocaleDateString('ar-IQ')
    const tag = `onesignal-installment-due-${i.id}-${bucket}`
    const title = 'تنبيه قسط مستحق أو متأخر'
    const body = `${i.sale.customer.fullName} - ${i.sale.car.brand} ${i.sale.car.model} - المتبقي ${remaining.toLocaleString('en-US')} ${i.sale.currency} - الاستحقاق ${dueDate}`

    const userIds: string[] = []
    for (const user of targetUsers) {
      const exists = await prisma.notificationDelivery.findUnique({ where: { userId_tag: { userId: user.id, tag } } }).catch(() => null)
      if (exists) { skipped++; continue }
      userIds.push(user.id)
      checked++
    }

    if (!userIds.length) continue

    const result = await sendWithFallbackToAll(userIds, title, body, '/installments', tag)
    sent += result.sent || 0
    failed += result.failed || 0
    details.push({ installmentId: i.id, customer: i.sale.customer.fullName, sent: result.sent || 0, ok: result.ok, status: result.status, data: result.data })

    if (result.ok) {
      for (const userId of userIds) {
        await prisma.notificationDelivery.create({
          data: { userId, title, body, tag, installmentId: i.id }
        }).catch(() => null)
      }
    }
  }

  return {
    provider: 'onesignal',
    configured: oneSignalConfigured(),
    repeatMinutes,
    targeting: env('ONESIGNAL_STRICT_USER_TARGETING') === 'true' ? 'external-user-id' : 'all-subscribed-users',
    installments: installments.length,
    users: targetUsers.length,
    checked,
    skipped,
    sent,
    failed,
    details
  }
}
