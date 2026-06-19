import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
import { ensurePurchaseTable } from '../../utils/schema'

const schema = z.object({ confirm: z.string() })

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings')
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'هذه العملية للمدير فقط' })

  const body = schema.parse(await readBody(event))
  if (body.confirm !== 'RESET-AUTODEALER') throw createError({ statusCode: 400, message: 'رمز التأكيد غير صحيح' })

  await ensurePurchaseTable()

  await prisma.$transaction(async (tx) => {
    // ترتيب الحذف مهم بسبب العلاقات بين الجداول.
    await tx.notificationDelivery.deleteMany().catch(() => null)
    await tx.payment.deleteMany().catch(() => null)
    await tx.installment.deleteMany().catch(() => null)
    await tx.invoice.deleteMany().catch(() => null)
    await tx.sale.deleteMany().catch(() => null)
    await tx.purchase.deleteMany().catch(() => null)
    await tx.cashboxTransaction.deleteMany().catch(() => null)
    await tx.expense.deleteMany().catch(() => null)
    await tx.customerDocument.deleteMany().catch(() => null)
    await tx.customerContact.deleteMany().catch(() => null)
    await tx.customer.deleteMany().catch(() => null)
    await tx.car.deleteMany().catch(() => null)
    await tx.carBrand.deleteMany().catch(() => null)
    await tx.customerCategory.deleteMany().catch(() => null)
    await tx.offerDiscount.deleteMany().catch(() => null)
    await tx.backupLog.deleteMany().catch(() => null)
    await tx.auditLog.deleteMany().catch(() => null)

    // احذف الموظفين والحسابات الفرعية فقط، وأبقِ حساب المدير الحالي وحسابات ADMIN.
    await tx.pushSubscription.deleteMany({ where: { user: { role: { not: 'ADMIN' } } } }).catch(() => null)
    await tx.user.deleteMany({ where: { role: { not: 'ADMIN' } } }).catch(() => null)
  })

  await audit(user.fullName, 'إعادة ضبط المصنع', 'System', 'factory', 'تم مسح كل بيانات النظام مع الإبقاء على حساب المدير فقط')
  return { ok: true, message: 'تم مسح كل البيانات مع الإبقاء على حساب المدير فقط' }
})
