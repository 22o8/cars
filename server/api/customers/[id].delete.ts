import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'customers'); const id=getRouterParam(event,'id')!; const c=await prisma.customer.delete({where:{id}}); await audit(user.fullName,'حذف عميل','Customer',id,c.fullName); return {ok:true} })
