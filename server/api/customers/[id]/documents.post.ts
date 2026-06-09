import { z } from 'zod'
import { prisma } from '../../../utils/db'
import { requirePermission } from '../../../utils/auth'
import { audit } from '../../../utils/audit'
const schema=z.object({title:z.string().default('مستمسك'), imageData:z.string().min(10), notes:z.string().optional().nullable()})
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'customers'); const customerId=getRouterParam(event,'id')!; const b=schema.parse(await readBody(event)); const doc=await prisma.customerDocument.create({data:{customerId,...b}}); await audit(user.fullName,'رفع مستمسك عميل','CustomerDocument',doc.id,b.title); return doc })
