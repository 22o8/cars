import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema = z.object({ fullName:z.string().min(1).optional(), username:z.string().min(1).optional(), password:z.string().min(4).optional().or(z.literal('')), role:z.enum(['ADMIN','ACCOUNTANT','SALES','VIEWER']).optional(), active:z.boolean().optional(), permissions:z.array(z.string()).optional(), profileImage:z.string().nullable().optional() })
export default defineEventHandler(async(event)=>{
  const user = await requirePermission(event,'employees')
  const id = getRouterParam(event,'id')!
  const body = schema.parse(await readBody(event))
  const target = await prisma.user.findUnique({ where: { id } })
  if(!target) throw createError({ statusCode:404, message:'الموظف غير موجود' })
  if(target.username === 'admin' && body.active === false) throw createError({ statusCode:400, message:'لا يمكن تعطيل المدير الأساسي' })
  const data:any = {}
  for (const k of ['fullName','username','role','active','permissions','profileImage']) if((body as any)[k] !== undefined) data[k] = (body as any)[k]
  if(body.password) data.password = await bcrypt.hash(body.password, 10)
  const updated = await prisma.user.update({ where:{id}, data, select:{id:true,fullName:true,username:true,role:true,active:true,permissions:true,profileImage:true,createdAt:true} })
  await audit(user.fullName,'تعديل موظف','User',id,updated.username)
  return updated
})
