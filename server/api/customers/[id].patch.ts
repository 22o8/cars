import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({fullName:z.string().min(1).optional(), phone:z.string().min(1).optional(), phone2:z.string().optional().nullable(), address:z.string().optional().nullable(), notes:z.string().optional().nullable(), documentImages:z.any().optional()})
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'customers'); const id=getRouterParam(event,'id')!; const b=schema.parse(await readBody(event)); const c=await prisma.customer.update({where:{id},data:b}); await audit(user.fullName,'تعديل عميل','Customer',id,c.fullName); return c })
