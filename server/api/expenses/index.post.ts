import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({title:z.string().min(1), amount:z.number().positive(), currency:z.enum(['IQD','USD']).default('IQD'), category:z.string().default('عام'), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'expenses'); const b=schema.parse(await readBody(event)); const expense=await prisma.$transaction(async(tx)=>{ const e=await tx.expense.create({data:b}); await tx.cashboxTransaction.create({data:{type:'EXPENSE', amount:b.amount, currency:b.currency, description:`مصروف: ${b.title}`, referenceId:e.id}}); return e }); await audit(user.fullName,'تسجيل مصروف','Expense',expense.id,`${expense.title} - ${expense.amount}`); return expense })
