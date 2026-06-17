import { ensurePurchaseTable } from '../../utils/schema'
import { requirePermission } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings')
  await ensurePurchaseTable()
  return { ok: true, message: 'تم تجهيز جدول الشراء Purchase بنجاح' }
})
