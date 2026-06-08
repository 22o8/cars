import { prisma } from '../../utils/db'
import { requireUser } from '../../utils/auth'
export default defineEventHandler(async (event) => { await requireUser(event); return prisma.sale.findMany({ include:{ car:true, customer:true, installments:true }, orderBy:{ saleDate:'desc' } }) })
