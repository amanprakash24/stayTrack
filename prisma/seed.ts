import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'

const adapter = new PrismaNeon({ connectionString: process.env['DATABASE_URL']! })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any) as InstanceType<typeof PrismaClient>

async function main() {
  console.log('Seeding database...')

  const adminPass = await bcrypt.hash('admin@staytrack', 10)
  const admin = await prisma.user.upsert({
    where: { id: 'superadmin-seed' },
    update: {},
    create: {
      id: 'superadmin-seed',
      name: 'Admin',
      password: adminPass,
      role: 'SUPERADMIN',
      location: null,
    },
  })
  console.log(`✓ Superadmin: "${admin.name}" | password: admin@staytrack`)

  const hotels = [
    { name: 'Pine Ridge Resort', location: 'Darjeeling', totalRooms: 8 },
    { name: 'Misty Heights', location: 'Darjeeling', totalRooms: 6 },
    { name: 'Sikkim Valley View', location: 'Gangtok', totalRooms: 10 },
    { name: 'Cloud Nine', location: 'Gangtok', totalRooms: 5 },
    { name: 'Cedar View Retreat', location: 'Himachal', totalRooms: 12 },
  ]

  for (const h of hotels) {
    const exists = await prisma.hotel.findFirst({ where: { name: h.name } })
    if (!exists) {
      await prisma.hotel.create({ data: h })
      console.log(`✓ Hotel: ${h.name} (${h.location}, ${h.totalRooms} rooms)`)
    }
  }

  console.log('\n✅ Seed complete!')
  console.log('Login: Name = Admin | Password = admin@staytrack')
  console.log('Then create partner accounts in the Admin panel.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
