import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../utils/db'
import { signToken, userPermissions } from '../../utils/auth'

const schema = z.object({ username: z.string().min(1), password: z.string().min(1) })
export default defineEventHandler(async (event) => {
  const body = schema.parse(await readBody(event))
  const user = await prisma.user.findUnique({ where: { username: body.username } })
  if (!user || !user.active) throw createError({ statusCode: 401, message: 'بيانات الدخول غير صحيحة' })
  const ok = await bcrypt.compare(body.password, user.password)
  if (!ok) throw createError({ statusCode: 401, message: 'بيانات الدخول غير صحيحة' })
  const token = signToken({ id: user.id, role: user.role })
  setCookie(event, 'adp_token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
  return { user: { id: user.id, fullName: user.fullName, username: user.username, role: user.role, profileImage: user.profileImage, permissions: userPermissions(user) } }
})
