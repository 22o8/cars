import { prisma } from '../../../utils/db'
import { requirePermission } from '../../../utils/auth'
export default defineEventHandler(async(event)=>{ await requirePermission(event,'invoices'); const id=getRouterParam(event,'id')!; const inv=await prisma.invoice.findUnique({where:{id}, include:{sale:{include:{car:true,customer:true,installments:true,payments:true}}}}); if(!inv) throw createError({statusCode:404,message:'الفاتورة غير موجودة'}); return inv })
