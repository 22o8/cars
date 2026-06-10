import { z } from 'zod'
import { prisma } from '../../../utils/db'
import { requirePermission } from '../../../utils/auth'
import { audit } from '../../../utils/audit'
import { sendInstallmentPaidOneSignalAlert } from '../../../utils/onesignal'

const schema = z.object({ amount: z.number().positive().optional(), notes: z.string().optional().nullable() }).optional()

export default defineEventHandler(async(event)=>{
  const user = await requirePermission(event,'installments')
  const id = getRouterParam(event,'id')!
  const body = schema.parse(await readBody(event).catch(()=>({})) || {}) || {}
  const result = await prisma.$transaction(async(tx)=>{
    const inst = await tx.installment.findUnique({where:{id}, include:{sale:{include:{customer:true,car:true}}}})
    if(!inst) throw createError({statusCode:404, message:'القسط غير موجود'})
    if(inst.status === 'PAID') throw createError({statusCode:400, message:'هذا القسط مسدد مسبقاً'})
    const remaining = Math.max(Number(inst.amount) - Number(inst.paidAmount), 0)
    const amount = Math.min(Number(body.amount || remaining), remaining)
    if(amount <= 0) throw createError({statusCode:400, message:'مبلغ التسديد غير صحيح'})
    const newPaid = Number(inst.paidAmount) + amount
    const fullyPaid = newPaid >= Number(inst.amount)
    const paid = await tx.installment.update({
      where:{id},
      data:{ paidAmount: newPaid, status: fullyPaid ? 'PAID' : 'PARTIAL', paidDate: fullyPaid ? new Date() : null }
    })
    await tx.payment.create({data:{ saleId:inst.saleId, installmentId:id, amount, currency:inst.sale.currency, notes: body.notes || (fullyPaid ? 'تسديد قسط كامل' : 'تسديد قسط جزئي') }})
    const totalPayments = await tx.payment.aggregate({ where:{ saleId: inst.saleId }, _sum:{ amount:true } })
    const newSalePaid = Number(totalPayments._sum.amount || 0)
    const saleRemaining = Math.max(Number(inst.sale.salePrice) - newSalePaid, 0)
    await tx.sale.update({where:{id:inst.saleId}, data:{ paidAmount:newSalePaid, remainingAmount:saleRemaining }})
    await tx.cashboxTransaction.create({data:{type:'INCOME', amount, currency:inst.sale.currency, description: fullyPaid ? 'تسديد قسط كامل' : 'تسديد قسط جزئي', referenceId:id}})
    const invNo=`PAY-${Date.now()}`
    await tx.invoice.create({data:{ invoiceNumber: invNo, invoiceType:'سند قبض قسط', saleId:inst.saleId, customerName: inst.sale.customer.fullName, customerPhone: inst.sale.customer.phone, title:`تسديد القسط رقم ${inst.installmentNumber} - ${inst.sale.car.brand} ${inst.sale.car.model}`, amount, currency:inst.sale.currency, notes: body.notes || '' }})
    return {
      paid,
      notificationInfo: {
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        customerName: inst.sale.customer.fullName,
        carName: `${inst.sale.car.brand} ${inst.sale.car.model}`,
        amount,
        currency: inst.sale.currency,
        fullyPaid
      }
    }
  })
  await audit(user.fullName,'تسديد قسط','Installment',id,`مبلغ التسديد: ${body.amount || 'كامل'}`)

  const notification = await sendInstallmentPaidOneSignalAlert(result.notificationInfo).catch((error:any)=>({
    ok:false,
    sent:0,
    failed:1,
    error:error?.message || 'تعذر إرسال إشعار التسديد'
  }))

  return { ...result.paid, notification }
})
