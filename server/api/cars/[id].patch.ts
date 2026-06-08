import { z } from 'zod'
import { prisma } from '../../utils/db'
import { requirePermission } from '../../utils/auth'
import { audit } from '../../utils/audit'
const schema = z.object({ brand:z.string().min(1).optional(), model:z.string().min(1).optional(), year:z.number().optional(), vinNumber:z.string().optional().nullable(), plateNumber:z.string().optional().nullable(), color:z.string().optional().nullable(), mileage:z.number().optional(), purchasePrice:z.number().optional(), salePrice:z.number().optional(), currency:z.enum(['IQD','USD']).optional(), status:z.enum(['AVAILABLE','RESERVED','SOLD','MAINTENANCE','ARCHIVED']).optional(), description:z.string().optional().nullable(), imageUrls:z.any().optional() })
export default defineEventHandler(async(event)=>{ const user=await requirePermission(event,'cars'); const id=getRouterParam(event,'id')!; const data=schema.parse(await readBody(event)); const car=await prisma.car.update({where:{id},data}); await audit(user.fullName,'تعديل سيارة','Car',id,`${car.brand} ${car.model}`); return car })
