import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({name:z.string().min(1), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requireUser(event); const b=schema.parse(await readBody(event)); const item=await prisma.customerCategory.create({data:b}); await audit(user.fullName,'إضافة فئة عملاء','CustomerCategory',item.id,item.name); return item })
