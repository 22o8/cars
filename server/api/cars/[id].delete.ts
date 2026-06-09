import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'cars'); const id=getRouterParam(event,'id')!; const used=await prisma.sale.count({where:{carId:id}}); if(used>0) throw createError({statusCode:400,message:'لا يمكن حذف سيارة مرتبطة ببيع. غيّر حالتها إلى مؤرشفة بدل الحذف.'}); const car=await prisma.car.delete({where:{id}}); await audit(user.fullName,'حذف سيارة','Car',id,`${car.brand} ${car.model}`); return {ok:true} })
