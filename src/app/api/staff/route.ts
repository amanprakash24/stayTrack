import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const staffSelect = {
  id: true, name: true, active: true, createdAt: true, passwordText: true,
  hotel: { select: { id: true, name: true, location: true, code: true } },
} as const

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const staff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      select: staffSelect,
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(staff)
  } catch (e) {
    console.error('[GET /api/staff]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { hotelId, password } = await req.json()
  if (!hotelId || !password) {
    return NextResponse.json({ error: 'Hotel and password required' }, { status: 400 })
  }

  try {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } })
    if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

    // One staff account per hotel
    const exists = await prisma.user.findFirst({ where: { role: 'STAFF', hotelId } })
    if (exists) {
      return NextResponse.json({ error: `"${hotel.name}" already has a staff account` }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const staff = await prisma.user.create({
      data: {
        name: `${hotel.name.trim()} Staff`,
        password: hashed,
        passwordText: password,
        role: 'STAFF',
        location: hotel.location,
        hotelId,
      },
      select: staffSelect,
    })
    return NextResponse.json(staff, { status: 201 })
  } catch (e) {
    console.error('[POST /api/staff]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
