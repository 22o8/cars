import { prisma } from './db'

function env(name: string) {
  return String(process.env[name] || '').trim().replace(/^['\"]|['\"]$/g, '')
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
  // القيمة الافتراضية للتجربة: 5 دقائق.
  // للإنتاج اليومي استخدم 1440 حتى يكرر التنبيه مرة كل يوم.
  const value = Number(env('INSTALLMENT_ALERT_REPEAT_MINUTES') || 1440)
  if (!Number.isFinite(value) || value < 1) return 1440
  return Math.floor(value)
}

function oneSignalAuthHeaders() {
  const key = env('ONESIGNAL_REST_API_KEY')
  // OneSignal v2 يستخدم Key، وبعض Legacy تقبل Basic. نجرب الاثنين بدون كشف المفتاح في الرد.
  return key.startsWith('os_v2_') ? [`Key ${key}`, `Basic ${key}`] : [`Basic ${key}`, `Key ${key}`]
}

async function sendOneSignalNotification(payload: any) {
  if (!oneSignalConfigured()) return { ok: false, sent: 0, failed: 0, reason: 'not-configured' }

  const body = {
    app_id: oneSignalAppId(),
    target_channel: 'push',
    ...payload
  }

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

    // OneSignal أحياناً يرجع HTTP 200 لكن الرسالة لم تصل لأن المستلمين صفر.
    // لذلك لا نعتبر العملية ناجحة إلا إذا لم توجد أخطاء وكان عدد المستلمين أكبر من صفر.
    if (res.ok && !errors.length && recipients > 0) {
      return { ok: true, sent: recipients, failed: 0, data }
    }

    // إذا OneSignal قبل الطلب لكن لا يوجد مستلمين، نرجعها كفشل واضح حتى نجرب fallback آخر.
    if (res.ok && errors.length) {
      last = { status: 200, data, softError: true }
      break
    }

    // جرّب صيغة Authorization الثانية فقط في حالة رفض المفتاح.
    if (![401, 403].includes(res.status)) break
  }

  return {
    ok: false,
    sent: 0,
    failed: 1,
    status: last?.status,
    data: last?.data,
    hint: 'إذا كان المفتاح صحيحاً وظهرت رسالة All included players are not subscribed فالمشكلة غالباً اسم Segment. الكود يجرب Total Subscriptions ثم Subscribed Users ثم All.'
  }
}

async function sendOneSignalNotificationWithFallback(payloads: any[]) {
  const attempts: any[] = []
  for (const payload of payloads) {
    const result: any = await sendOneSignalNotification(payload)
    attempts.push({ audience: payload.included_segments || payload.include_aliases || payload.include_subscription_ids || payload.filters, result })
    if (result.ok && (result.sent || 0) > 0) {
      return { ...result, attempts }
    }
  }
  const last = attempts[attempts.length - 1]?.result || { ok: false, sent: 0, failed: 1 }
  return { ...last, attempts }
}

export async function sendOneSignalToUsers(userIds: string[], title: string, body: string, url = '/', tag?: string) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return { ok: true, sent: 0, failed: 0, skipped: true }

  return sendOneSignalNotification({
    // الطريقة الحديثة مع OneSignal v16/users: الإرسال حسب external_id.
    include_aliases: { external_id: ids },
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
  const basePayload = {
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
  }

  // في OneSignal الجديد اسم الشريحة الافتراضية يظهر غالباً Total Subscriptions.
  // نترك أكثر من محاولة حتى لا تتوقف الإشعارات بسبب اختلاف اسم Segment بين الحسابات.
  return sendOneSignalNotificationWithFallback([
    { ...basePayload, included_segments: ['Total Subscriptions'] },
    { ...basePayload, included_segments: ['Subscribed Users'] },
    { ...basePayload, included_segments: ['All'] }
  ])
}

async function sendWithFallbackToAll(userIds: string[], title: string, body: string, url: string, tag: string) {
  // افتراضياً نرسل لكل المشتركين لأن حسابات OneSignal الموجودة عندك مسجلة External ID مختلف عن id قاعدة البيانات.
  // إذا تريد ربط صارم حسب الموظف فقط، ضع ONESIGNAL_STRICT_USER_TARGETING=true في Vercel.
  if (env('ONESIGNAL_STRICT_USER_TARGETING') !== 'true') {
    return sendOneSignalToAll(title, body, url, tag)
  }

  const byUser = await sendOneSignalToUsers(userIds, title, body, url, tag)
  if ((byUser.sent || 0) > 0 || byUser.failed) return byUser

  // fallback يمنع حالة No recipients إذا كان external_id غير مطابق.
  if (env('ONESIGNAL_FALLBACK_TO_ALL') !== 'false') {
    return sendOneSignalToAll(title, body, url, `${tag}-all`)
  }
  return byUser
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
    const title = 'تنبيه قسط مستحق'
    const body = `${i.sale.customer.fullName} - ${i.sale.car.brand} ${i.sale.car.model} - المتبقي ${remaining.toLocaleString('en-US')} - الاستحقاق ${dueDate}`

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
