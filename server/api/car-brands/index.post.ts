import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({name:z.string().min(1), category:z.string().default('عام'), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requireUser(event); const b=schema.parse(await readBody(event)); const item=await prisma.carBrand.create({data:b}); await audit(user.fullName,'إضافة فئة أو ماركة','CarBrand',item.id,item.name); return item })
