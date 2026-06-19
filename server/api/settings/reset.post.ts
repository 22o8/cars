import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
import { ensurePurchaseTable } from '../../utils/schema'

const schema = z.object({ confirm: z.string() })

async function safeDelete(table: string, where = '') {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}" ${where}`)
  } catch (error: any) {
  // لا نوقف عملية المسح إذا جدول اختياري غير موجود في قاعدة قديمة.
    const message = String(error?.message || '')
    if (!message.includes('does not exist') && !message.includes('does not exist in the current database')) {
      console.warn(`Reset skip table ${table}:`, message)
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'settings')
  if (user.role !== 'ADMIN') throw createError({ statusCode: 403, message: 'هذه العملية للمدير فقط' })

  const body = schema.parse(await readBody(event))
  if (body.confirm !== 'RESET-AUTODEALER') throw createError({ statusCode: 400, message: 'رمز التأكيد غير صحيح' })

  await ensurePurchaseTable().catch(() => null)

  // حذف كل البيانات التشغيلية مع إبقاء حسابات المدير فقط. لا نحذف DealerSetting حتى تبقى إعدادات المعرض وOneSignal.
  const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  const adminIds = adminUsers.map((x) => x.id)
  const adminList = adminIds.length ? adminIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(',') : "''"

  // سجلات مرتبطة بالمبيعات والأقساط.
  await safeDelete('NotificationDelivery')
  await safeDelete('Payment')
  await safeDelete('Installment')
  await safeDelete('Invoice')
  await safeDelete('Sale')

  // سجلات الشراء الجديدة والقديمة.
  await safeDelete('Purchase')

  // الحركة المالية والمصاريف.
  await safeDelete('CashboxTransaction')
  await safeDelete('Expense')

  // العملاء ومستمسكاتهم وتواصلهم.
  await safeDelete('CustomerDocument')
  await safeDelete('CustomerContact')
  await safeDelete('Customer')

  // المخزن والسيارات وكل التصنيفات التشغيلية.
  await safeDelete('Car')
  await safeDelete('CarBrand')
  await safeDelete('CustomerCategory')
  await safeDelete('OfferDiscount')

  // النسخ والسجلات والتنبيهات التشغيلية.
  await safeDelete('BackupLog')
  await safeDelete('AuditLog')

  // الاشتراكات والحسابات: احذف كل شيء ما عدا حسابات المدير.
  await safeDelete('PushSubscription', `WHERE "userId" NOT IN (${adminList})`)
  await safeDelete('User', `WHERE "role" <> 'ADMIN'`)

  await audit(user.fullName, 'إعادة ضبط المصنع', 'System', 'factory', 'تم مسح كل بيانات النظام مع الإبقاء على حساب المدير فقط')
  return {
    ok: true,
    message: 'تم مسح كل البيانات التشغيلية، وتم الإبقاء على حساب المدير فقط',
    keptAdminUsers: adminIds.length
  }
})
