import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hotels = await prisma.hotel.findMany({
    where: {
      active: true,
      // Staff only see their own hotel
      ...(session.role === 'STAFF' ? { id: session.hotelId ?? '' } : {}),
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(hotels)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, location, totalRooms, standardRooms, deluxeRooms, tourismFee, managerName, managerPhone } = await req.json()
  if (!name || !location || !totalRooms) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  // If a room-type split is given, it must add up to the total
  if (standardRooms || deluxeRooms) {
    const sum = (Number(standardRooms) || 0) + (Number(deluxeRooms) || 0)
    if (sum !== Number(totalRooms)) {
      return NextResponse.json({ error: `Standard + Deluxe rooms (${sum}) must equal total rooms (${totalRooms})` }, { status: 400 })
    }
  }

  // Assign the next free 3-digit hotel code (used in booking numbers)
  const existing = await prisma.hotel.findMany({ select: { code: true } })
  const used = new Set(existing.map(h => h.code).filter(Boolean))
  let n = existing.length + 1
  while (used.has(String(n).padStart(3, '0'))) n++

  const hotel = await prisma.hotel.create({
    data: {
      name, location, totalRooms: Number(totalRooms),
      standardRooms: standardRooms ? Number(standardRooms) : null,
      deluxeRooms: deluxeRooms ? Number(deluxeRooms) : null,
      tourismFee: tourismFee ? Number(tourismFee) : null,
      code: String(n).padStart(3, '0'),
      managerName: managerName || null,
      managerPhone: managerPhone || null,
    },
  })
  return NextResponse.json(hotel, { status: 201 })
}
