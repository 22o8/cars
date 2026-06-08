import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema = z.object({ brand:z.string().min(1), model:z.string().min(1), year:z.number(), vinNumber:z.string().optional().nullable(), plateNumber:z.string().optional().nullable(), color:z.string().optional().nullable(), mileage:z.number().default(0), purchasePrice:z.number().default(0), salePrice:z.number().default(0), currency:z.enum(['IQD','USD']).default('IQD'), status:z.enum(['AVAILABLE','RESERVED','SOLD','MAINTENANCE','ARCHIVED']).default('AVAILABLE'), description:z.string().optional().nullable(), imageUrls:z.any().optional() })
export default defineEventHandler(async (event) => { const user=await requirePermission(event,'cars'); const data=schema.parse(await readBody(event)); const car=await prisma.car.create({ data }); await audit(user.fullName,'إضافة سيارة','Car',car.id,`${car.brand} ${car.model}`); return car })
