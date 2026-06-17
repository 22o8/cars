import { ensurePurchaseTable } from '../../utils/schema'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event,'purchases')
  await ensurePurchaseTable()
  const id = String(getRouterParam(event,'id'))
  const p = await prisma.purchase.findUnique({ where: { id } })
  if (!p) throw createError({ statusCode: 404, message: 'عملية الشراء غير موجودة' })
  await prisma.purchase.delete({ where: { id } })
  await audit(user.fullName,'حذف شراء سيارة','Purchase',id,`${p.carName} من ${p.sellerName}`)
  return { ok: true }
})
