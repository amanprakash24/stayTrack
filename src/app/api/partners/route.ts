import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER' },
      select: {
        id: true, name: true, location: true, active: true, createdAt: true,
        hotel: { select: { id: true, name: true, location: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(partners)
  } catch (e) {
    console.error('[GET /api/partners]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name, password, location, hotelId } = await req.json()
  if (!name || !password) {
    return NextResponse.json({ error: 'Name and password required' }, { status: 400 })
  }

  try {
    const exists = await prisma.user.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    })
    if (exists) {
      return NextResponse.json({ error: 'Partner name already exists' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 10)
    const partner = await prisma.user.create({
      data: {
        name,
        password: hashed,
        role: 'PARTNER',
        location: location || null,
        hotelId: hotelId || null,
      },
      select: {
        id: true, name: true, location: true, active: true, createdAt: true,
        hotel: { select: { id: true, name: true, location: true } },
      },
    })
    return NextResponse.json(partner, { status: 201 })
  } catch (e) {
    console.error('[POST /api/partners]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
