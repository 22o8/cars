import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
import { syncInstallments } from '../../utils/installments'
export default defineEventHandler(async(event)=>{
  await requireUser(event)
  await syncInstallments(prisma)
  const now=new Date()
  const due=await prisma.installment.count({where:{status:{not:'PAID'}, dueDate:{lte:now}}})
  const soldToday=await prisma.sale.count({where:{saleDate:{gte:new Date(new Date().toDateString())}}})
  return [{type:'warning',title:'الأقساط المستحقة',body:`لديك ${due} قسط مستحق أو متأخر`},{type:'success',title:'مبيعات اليوم',body:`تم تسجيل ${soldToday} عملية بيع اليوم`}]
})
