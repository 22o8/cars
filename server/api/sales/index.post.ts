import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
import { sendDueInstallmentOneSignalAlerts } from '../../utils/onesignal'

const schema=z.object({
  carId:z.string(), customerId:z.string(), saleType:z.enum(['CASH','INSTALLMENT','TRADE_IN']).default('CASH'),
  salePrice:z.number().positive(), firstPayment:z.number().min(0).default(0), currency:z.enum(['IQD','USD']).default('IQD'),
  notes:z.string().optional().nullable(), installmentsCount:z.number().optional().default(0), intervalDays:z.number().optional().default(30), firstDueDate:z.string().optional(),
  tradeInBrand:z.string().optional().nullable(), tradeInModel:z.string().optional().nullable(), tradeInYear:z.number().optional().nullable(), tradeInValue:z.number().optional().default(0), tradeInNotes:z.string().optional().nullable()
})

export default defineEventHandler(async(event)=>{
 const user=await requirePermission(event,'sales')
 const b=schema.parse(await readBody(event))
 const normalizedFirstPayment = b.saleType === 'CASH' && b.firstPayment <= 0 ? b.salePrice : Math.min(b.firstPayment, b.salePrice)
 const tradeValue = b.saleType === 'TRADE_IN' ? Number(b.tradeInValue || 0) : 0
 const paidInitial = Math.min(normalizedFirstPayment + tradeValue, b.salePrice)
 const remaining=Math.max(b.salePrice-paidInitial,0)
 const sale=await prisma.$transaction(async(tx)=>{
  const car=await tx.car.findUnique({where:{id:b.carId}})
  const customer=await tx.customer.findUnique({where:{id:b.customerId}})
  if(!car || !customer) throw createError({statusCode:400,message:'بيانات البيع غير مكتملة'})
  if(car.status !== 'AVAILABLE') throw createError({statusCode:400,message:'هذه السيارة غير متوفرة للبيع'})
  const notes = [b.notes, b.saleType === 'TRADE_IN' ? `مراوسة: ${b.tradeInBrand||''} ${b.tradeInModel||''} ${b.tradeInYear||''} - قيمة المراوسة ${tradeValue}` : ''].filter(Boolean).join(' | ')
  const s=await tx.sale.create({ data:{ carId:b.carId, customerId:b.customerId, soldByUserId:user.id, saleType:b.saleType, salePrice:b.salePrice, firstPayment:normalizedFirstPayment, paidAmount:paidInitial, remainingAmount:remaining, currency:b.currency, notes } })
  await tx.car.update({ where:{id:b.carId}, data:{status:'SOLD'} })
  if(normalizedFirstPayment>0){ await tx.payment.create({data:{saleId:s.id, amount:normalizedFirstPayment, currency:b.currency, notes:'الدفعة الأولى'}}); await tx.cashboxTransaction.create({data:{type:'INCOME', amount:normalizedFirstPayment, currency:b.currency, description:'دفعة أولى من بيع سيارة', referenceId:s.id}}) }
  if(b.saleType==='TRADE_IN' && tradeValue>0){ await tx.cashboxTransaction.create({data:{type:'INCOME', amount:tradeValue, currency:b.currency, description:'قيمة سيارة مراوسة محسوبة ضمن البيع', referenceId:s.id}}) }
  if(b.saleType !== 'CASH' && remaining > 0){
    const count = Math.max(1, Number(b.installmentsCount || 1))
    const baseAmount = Math.floor((remaining / count) * 100) / 100
    const start = b.firstDueDate ? new Date(b.firstDueDate) : new Date()
    for(let i = 1; i <= count; i++){
      const d = new Date(start)
      d.setDate(start.getDate() + ((i - 1) * Number(b.intervalDays || 30)))
      const amount = i === count ? Math.round((remaining - (baseAmount * (count - 1))) * 100) / 100 : baseAmount
      await tx.installment.create({
        data: {
          saleId: s.id,
          installmentNumber: i,
          amount,
          paidAmount: 0,
          dueDate: d,
          status: d < new Date() ? 'LATE' : 'PENDING'
        }
      })
    }
  }
  const invNo=`SALE-${Date.now()}`; await tx.invoice.create({data:{invoiceNumber:invNo, invoiceType:'فاتورة بيع سيارة', saleId:s.id, customerName:customer.fullName, customerPhone:customer.phone, title:`بيع ${car.brand} ${car.model} ${car.year}`, amount:b.salePrice, currency:b.currency, notes:`المدفوع: ${paidInitial} | المتبقي: ${remaining}`}})
  return s
 })
 await audit(user.fullName,'بيع سيارة','Sale',sale.id,`قيمة البيع: ${b.salePrice} | المدفوع: ${paidInitial} | المتبقي: ${remaining}`)

 // إذا تم إنشاء بيع أقساط/مراوسة وأول قسط مستحق اليوم أو متأخر، نرسل التنبيه فوراً بدل انتظار Cron اليومي.
 let notification:any = null
 if (b.saleType !== 'CASH' && remaining > 0) {
   const firstDue = b.firstDueDate ? new Date(b.firstDueDate) : new Date()
   const todayEnd = new Date()
   todayEnd.setHours(23, 59, 59, 999)
   if (firstDue <= todayEnd) {
     notification = await sendDueInstallmentOneSignalAlerts().catch((error:any) => ({
       ok: false,
       sent: 0,
       failed: 1,
       error: error?.message || 'تعذر إرسال تنبيه القسط بعد البيع'
     }))
   }
 }

 return { ...sale, notification }
})
