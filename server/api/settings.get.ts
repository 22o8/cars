import { prisma } from '../utils/db'
import { requireUser } from '../utils/auth'
export default defineEventHandler(async(event)=>{ await requireUser(event); return prisma.dealerSetting.upsert({where:{id:1}, update:{}, create:{id:1, dealerName:'AutoDealer Pro'}}) })
