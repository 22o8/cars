import jwt from 'jsonwebtoken'
import { prisma } from './db'

export function signToken(payload: any) {
  const config = useRuntimeConfig()
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}

export async function getCurrentUser(event: any) {
  const token = getCookie(event, 'adp_token')
  if (!token) return null
  try {
    const config = useRuntimeConfig()
    const decoded = jwt.verify(token, config.jwtSecret) as any
    return await prisma.user.findUnique({ where: { id: decoded.id } })
  } catch { return null }
}

export async function requireUser(event: any) {
  const user = await getCurrentUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'غير مصرح' })
  return user
}

export async function requireRole(event: any, roles: string[]) {
  const user = await requireUser(event)
  if (!roles.includes(user.role)) throw createError({ statusCode: 403, message: 'لا تملك صلاحية تنفيذ هذه العملية' })
  return user
}

const rolePermissions: Record<string, string[]> = {
  ADMIN: ['dashboard','cars','customers','sales','purchases','installments','invoices','expenses','accounts','reports','employees','settings'],
  ACCOUNTANT: ['dashboard','sales','purchases','installments','invoices','expenses','accounts','reports','customers'],
  SALES: ['dashboard','cars','customers','sales','purchases','installments','invoices'],
  VIEWER: ['dashboard','cars','customers','reports']
}

export function userPermissions(user: any): string[] {
  if (!user) return []
  const base = rolePermissions[user.role] || []
  const extra = Array.isArray(user.permissions) ? user.permissions : []
  return Array.from(new Set([...base, ...extra]))
}

export async function requirePermission(event: any, permission: string) {
  const user = await requireUser(event)
  if (user.role === 'ADMIN') return user
  if (!userPermissions(user).includes(permission)) throw createError({ statusCode: 403, message: 'لا تملك صلاحية الوصول إلى هذا القسم' })
  return user
}
