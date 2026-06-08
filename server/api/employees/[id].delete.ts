import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'employees'); const id=getRouterParam(event,'id')!; const target=await prisma.user.findUnique({where:{id}}); if(!target) throw createError({statusCode:404,message:'الموظف غير موجود'}); if(target.username==='admin' || target.id===user.id) throw createError({statusCode:400,message:'لا يمكن حذف هذا الحساب'}); await prisma.user.delete({where:{id}}); await audit(user.fullName,'حذف موظف','User',id,target.username); return {ok:true} })
