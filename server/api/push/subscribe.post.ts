import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
const schema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) })
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = schema.parse(await readBody(event))
  const ua = getHeader(event, 'user-agent') || ''
  await prisma.pushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: { userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: ua, active: true },
    create: { userId: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth, userAgent: ua, active: true }
  })
  return { ok: true }
})
