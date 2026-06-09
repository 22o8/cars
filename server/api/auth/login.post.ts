import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../utils/db'
import { signToken, userPermissions } from '../../utils/auth'

const schema = z.object({
  username: z.string().trim().min(1).max(60).regex(/^[\p{L}\p{N}_.@-]+$/u),
  password: z.string().min(1).max(160)
})

type Attempt = { count: number; lockedUntil: number; firstAt: number }
const attempts = new Map<string, Attempt>()
const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 7

function getClientKey(event: any, username: string) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || event.node?.req?.socket?.remoteAddress || 'unknown'
  return `${ip}:${username.toLowerCase()}`
}
function checkLimit(key: string) {
  const now = Date.now()
  const item = attempts.get(key)
  if (!item) return
  if (item.lockedUntil > now) {
    const minutes = Math.ceil((item.lockedUntil - now) / 60000)
    throw createError({ statusCode: 429, message: `تم إيقاف المحاولات مؤقتاً. حاول بعد ${minutes} دقيقة` })
  }
  if (now - item.firstAt > WINDOW_MS) attempts.delete(key)
}
function recordFailure(key: string) {
  const now = Date.now()
  const item = attempts.get(key)
  if (!item || now - item.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, lockedUntil: 0, firstAt: now })
    return
  }
  item.count += 1
  if (item.count >= MAX_ATTEMPTS) item.lockedUntil = now + LOCK_MS
  attempts.set(key, item)
}
function clearFailure(key: string) { attempts.delete(key) }

export default defineEventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'البيانات غير صحيحة' })
  const body = parsed.data
  const key = getClientKey(event, body.username)
  checkLimit(key)

  const user = await prisma.user.findUnique({ where: { username: body.username } })
  let valid = false
  if (user && user.active) {
    const storedPassword = String(user.password || '')
    const looksHashed = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')
    if (looksHashed) {
      valid = await bcrypt.compare(body.password, storedPassword)
    } else {
      valid = storedPassword === body.password
      if (valid) {
        await prisma.user.update({
          where: { id: user.id },
          data: { password: await bcrypt.hash(body.password, 10) }
        })
      }
    }
  }
  if (!valid || !user) {
    recordFailure(key)
    await new Promise(resolve => setTimeout(resolve, 450))
    throw createError({ statusCode: 401, message: 'بيانات الدخول غير صحيحة' })
  }

  clearFailure(key)
  const token = signToken({ id: user.id, role: user.role })
  const isSecure = process.env.NODE_ENV === 'production'
  setCookie(event, 'adp_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 14
  })
  return { user: { id: user.id, fullName: user.fullName, username: user.username, role: user.role, profileImage: user.profileImage, permissions: userPermissions(user) } }
})
