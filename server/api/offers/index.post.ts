import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({title:z.string().min(1), type:z.string().default('خصم'), value:z.number().default(0), currency:z.enum(['IQD','USD']).default('IQD'), active:z.boolean().default(true), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requireUser(event); const b=schema.parse(await readBody(event)); const item=await prisma.offerDiscount.create({data:b}); await audit(user.fullName,'إضافة عرض أو خصم','OfferDiscount',item.id,item.title); return item })
