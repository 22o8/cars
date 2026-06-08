import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
import { syncInstallments } from '../../utils/installments'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'installments')
  const result = await syncInstallments(prisma)
  await audit(user.fullName, 'إصلاح ربط الأقساط', 'Installment', undefined, `تم إنشاء ${result.created} قسط مفقود وتحديث ${result.updatedSales} عقد`)
  return { ok: true, ...result }
})
