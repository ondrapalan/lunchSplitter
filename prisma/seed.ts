import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('admin123', 10)

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hash,
      displayName: 'Admin',
      role: 'ADMIN',
      isFirstLogin: true,
    },
  })

  console.log('Seeded admin user (username: admin, password: admin123)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
