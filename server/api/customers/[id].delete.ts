import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
export default defineEventHandler(async(event)=>{
  const user=await requirePermission(event,'customers')
  const id=getRouterParam(event,'id')!
  const used=await prisma.sale.count({where:{customerId:id}})
  if(used>0) throw createError({statusCode:400,message:'لا يمكن حذف عميل مرتبط بعقود أو مبيعات. يمكن تعديل بياناته بدلاً من الحذف.'})
  const c=await prisma.customer.delete({where:{id}})
  await audit(user.fullName,'حذف عميل','Customer',id,c.fullName)
  return {ok:true}
})
