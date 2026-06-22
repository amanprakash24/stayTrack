import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const data = await req.json()
  const hotel = await prisma.hotel.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      location: data.location ?? undefined,
      totalRooms: data.totalRooms ? Number(data.totalRooms) : undefined,
      managerName: data.managerName !== undefined ? (data.managerName || null) : undefined,
      active: data.active !== undefined ? data.active : undefined,
    },
  })
  return NextResponse.json(hotel)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  await prisma.hotel.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
