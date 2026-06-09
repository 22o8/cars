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

export async function sendDueInstallmentPushes() {
  const now = new Date()
  const installments = await prisma.installment.findMany({
    where: { status: { not: 'PAID' }, dueDate: { lte: now } },
    include: { sale: { include: { customer: true, car: true, soldBy: true } } },
    orderBy: { dueDate: 'asc' }
  })
  let checked = 0
  let sent = 0
  let failed = 0
  for (const i of installments) {
    const dueDay = i.dueDate.toISOString().slice(0, 10)
    const tag = `installment-${i.id}-${dueDay}`
    const users = await prisma.user.findMany({ where: { active: true } })
    for (const user of users) {
      const exists = await prisma.notificationDelivery.findUnique({ where: { userId_tag: { userId: user.id, tag } } }).catch(() => null)
      if (exists) continue
      checked++
      const result = await sendPushToUser(user.id, {
        title: 'قسط مستحق أو متأخر',
        body: `${i.sale.customer.fullName} - ${i.sale.car.brand} ${i.sale.car.model} - المتبقي ${Number(i.amount) - Number(i.paidAmount)}`,
        tag,
        url: '/installments',
        requireInteraction: true
      })
      sent += result.sent
      failed += result.failed
      if (result.sent > 0) {
        await prisma.notificationDelivery.create({ data: { userId: user.id, title: 'قسط مستحق أو متأخر', body: `${i.sale.customer.fullName} - ${i.sale.car.brand} ${i.sale.car.model}`, tag, installmentId: i.id } }).catch(() => null)
      }
    }
  }
  return { installments: installments.length, checked, sent, failed, configured: pushConfigured() }
}
