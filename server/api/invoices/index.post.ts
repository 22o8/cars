import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({customerName:z.string().min(1), customerPhone:z.string().optional().nullable(), invoiceType:z.string().min(1), title:z.string().min(1), amount:z.number().positive(), currency:z.enum(['IQD','USD']).default('IQD'), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{
  const user=await requirePermission(event,'invoices')
  const b=schema.parse(await readBody(event))
  const inv=await prisma.$transaction(async(tx)=>{
    const item=await tx.invoice.create({data:{...b, invoiceNumber:`INV-${Date.now()}`}})
    if(b.invoiceType.includes('قبض')) await tx.cashboxTransaction.create({data:{type:'INCOME', amount:b.amount, currency:b.currency, description:b.title, referenceId:item.id}})
    if(b.invoiceType.includes('صرف')) await tx.cashboxTransaction.create({data:{type:'EXPENSE', amount:b.amount, currency:b.currency, description:b.title, referenceId:item.id}})
    return item
  })
  await audit(user.fullName,'إنشاء فاتورة','Invoice',inv.id,`${inv.invoiceType} - ${inv.amount}`)
  return inv
})
