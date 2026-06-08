import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({customerName:z.string().min(1), phone:z.string().optional().nullable(), contactType:z.string().default('متابعة'), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requireUser(event); const b=schema.parse(await readBody(event)); const item=await prisma.customerContact.create({data:b}); await audit(user.fullName,'تسجيل تواصل مع عميل','CustomerContact',item.id,item.customerName); return item })
