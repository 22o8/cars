import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema = z.object({ fullName:z.string().min(1), phone:z.string().min(1), phone2:z.string().optional().nullable(), address:z.string().optional().nullable(), notes:z.string().optional().nullable(), documentImages:z.any().optional() })
export default defineEventHandler(async (event) => { const user=await requirePermission(event,'customers'); const data=schema.parse(await readBody(event)); const customer=await prisma.customer.create({ data }); await audit(user.fullName,'إضافة عميل','Customer',customer.id,customer.fullName); return customer })
