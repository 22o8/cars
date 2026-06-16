import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema=z.object({data:z.any()})
function strip(obj:any, keys:string[]){ const out:any={}; for(const [k,v] of Object.entries(obj||{})) if(!keys.includes(k)) out[k]=v; return out }
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'settings'); if(user.role!=='ADMIN') throw createError({statusCode:403,message:'الاستعادة للمدير فقط'}); const {data}=schema.parse(await readBody(event)); if(!data || typeof data !== 'object') throw createError({statusCode:400,message:'ملف النسخة غير صالح'});
  await prisma.$transaction(async(tx)=>{
    await tx.payment.deleteMany(); await tx.installment.deleteMany(); await tx.invoice.deleteMany(); await tx.sale.deleteMany(); await tx.cashboxTransaction.deleteMany(); await tx.purchase.deleteMany(); await tx.expense.deleteMany(); await tx.customerDocument.deleteMany(); await tx.customer.deleteMany(); await tx.car.deleteMany(); await tx.auditLog.deleteMany();
    if(data.settings) await tx.dealerSetting.upsert({where:{id:1},update:strip(data.settings,['updatedAt']),create:strip(data.settings,['updatedAt'])})
    if(Array.isArray(data.cars)) for(const c of data.cars){ await tx.car.create({data:strip(c,['sales'])}) }
    if(Array.isArray(data.customers)) for(const c of data.customers){ const docs=Array.isArray(c.documents)?c.documents:[]; await tx.customer.create({data:strip(c,['sales','documents'])}); for(const d of docs) await tx.customerDocument.create({data:strip(d,['customer'])}) }
    if(Array.isArray(data.sales)) for(const s of data.sales){ const saleData=strip(s,['car','customer','soldBy','installments','payments','invoices']); saleData.soldByUserId = user.id; try{ await tx.sale.create({data:saleData}) }catch{} }
    if(Array.isArray(data.sales)) for(const s of data.sales){ if(Array.isArray(s.installments)) for(const i of s.installments){ try{ await tx.installment.create({data:strip(i,['sale','payments'])}) }catch{} } }
    if(Array.isArray(data.sales)) for(const s of data.sales){ if(Array.isArray(s.payments)) for(const p of s.payments){ try{ await tx.payment.create({data:strip(p,['sale','installment'])}) }catch{} } }
    if(Array.isArray(data.purchases)) for(const p of data.purchases) try{ await tx.purchase.create({data:p}) }catch{}
    if(Array.isArray(data.expenses)) for(const e of data.expenses) try{ await tx.expense.create({data:e}) }catch{}
    if(Array.isArray(data.cashbox)) for(const t of data.cashbox) try{ await tx.cashboxTransaction.create({data:t}) }catch{}
    if(Array.isArray(data.invoices)) for(const i of data.invoices){ try{ await tx.invoice.create({data:strip(i,['sale'])}) }catch{} }
  });
  await prisma.backupLog.create({data:{title:'استعادة نسخة احتياطية',status:'مكتمل',notes:'تمت الاستعادة من ملف JSON'}}); await audit(user.fullName,'استعادة نسخة احتياطية','Backup',undefined,'تمت استعادة البيانات'); return {ok:true}
})
