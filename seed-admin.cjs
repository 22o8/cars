const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: {
      username: 'admin'
    },
    update: {
      password,
      active: true,
      role: 'ADMIN'
    },
    create: {
      fullName: 'مدير النظام',
      username: 'admin',
      password,
      role: 'ADMIN',
      active: true
    }
  });

  console.log('Admin created successfully');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });