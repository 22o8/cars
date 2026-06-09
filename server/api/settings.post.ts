import { z } from 'zod'
import { prisma } from '../utils/db'
import { requirePermission } from '../utils/auth'
import { audit } from '../utils/audit'
const schema=z.object({dealerName:z.string().min(1), phone:z.string().optional().default(''), address:z.string().optional().default(''), usdToIqdRate:z.number().default(1310), logoUrl:z.string().optional().default('')})
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'settings'); const b=schema.parse(await readBody(event)); const s=await prisma.dealerSetting.upsert({where:{id:1}, update:b, create:{id:1,...b}}); await audit(user.fullName,'تعديل الإعدادات','DealerSetting','1','تحديث بيانات المعرض'); return s })
