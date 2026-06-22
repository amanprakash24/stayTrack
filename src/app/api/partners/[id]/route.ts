import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/partners/[id]]', e)
    return NextResponse.json({ error: 'Cannot delete — partner may have bookings' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const { password, location, active, hotelId } = await req.json()

  const data: Record<string, unknown> = {}
  if (password) data.password = await bcrypt.hash(password, 10)
  if (location !== undefined) data.location = location || null
  if (active !== undefined) data.active = active
  if (hotelId !== undefined) data.hotelId = hotelId || null

  const partner = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true, name: true, location: true, active: true,
      hotel: { select: { id: true, name: true, location: true } },
    },
  })
  return NextResponse.json(partner)
}
