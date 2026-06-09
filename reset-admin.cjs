const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('admin123', 10)

  await prisma.user.updateMany({
    where: { username: 'admin' },
    data: { password }
  })

  console.log('Password reset successfully')
}

main().finally(async () => {
  await prisma.$disconnect()
})