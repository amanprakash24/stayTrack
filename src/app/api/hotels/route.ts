import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const hotels = await prisma.hotel.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(hotels)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, location, totalRooms, managerName, managerPhone } = await req.json()
  if (!name || !location || !totalRooms) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const hotel = await prisma.hotel.create({
    data: {
      name, location, totalRooms: Number(totalRooms),
      managerName: managerName || null,
      managerPhone: managerPhone || null,
    },
  })
  return NextResponse.json(hotel, { status: 201 })
}
