import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const prisma = new PrismaClient()
async function main() {
  const password = await bcrypt.hash('admin123', 10)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { active: true, role: 'ADMIN', permissions: ['dashboard','cars','customers','sales','installments','invoices','expenses','accounts','reports','employees','settings'] },
    create: { fullName: 'مدير النظام', username: 'admin', password, role: 'ADMIN', active: true, permissions: ['dashboard','cars','customers','sales','installments','invoices','expenses','accounts','reports','employees','settings'] }
  })
  await prisma.dealerSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1, dealerName: 'معرض السيارات', usdToIqdRate: 1310 } })
}
main().finally(() => prisma.$disconnect())
