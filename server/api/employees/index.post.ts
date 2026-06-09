import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({fullName:z.string().min(1), username:z.string().min(1), password:z.string().min(4), role:z.enum(['ADMIN','ACCOUNTANT','SALES','VIEWER']).default('SALES'), permissions:z.array(z.string()).default([]), profileImage:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'employees'); const b=schema.parse(await readBody(event)); const u=await prisma.user.create({data:{fullName:b.fullName, username:b.username, password:await bcrypt.hash(b.password,10), role:b.role, active:true, permissions:b.permissions, profileImage:b.profileImage || null}}); await audit(user.fullName,'إضافة موظف','User',u.id,`${u.fullName} / ${u.username}`); return {id:u.id, fullName:u.fullName, username:u.username, role:u.role, active:u.active, permissions:u.permissions, profileImage:u.profileImage, createdAt:u.createdAt} })
