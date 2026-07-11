import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const staffSelect = {
  id: true, name: true, active: true, createdAt: true, passwordText: true,
  hotel: { select: { id: true, name: true, location: true, code: true } },
} as const

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { password, active } = await req.json()

  const staff = await prisma.user.findFirst({ where: { id, role: 'STAFF' } })
  if (!staff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (typeof active === 'boolean') data.active = active
  if (password) {
    data.password = await bcrypt.hash(password, 10)
    data.passwordText = password
  }

  const updated = await prisma.user.update({ where: { id }, data, select: staffSelect })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const staff = await prisma.user.findFirst({
    where: { id, role: 'STAFF' },
    include: { _count: { select: { bookings: true, payments: true, expenses: true, auditLogs: true } } },
  })
  if (!staff) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const hasRecords = staff._count.bookings + staff._count.payments + staff._count.expenses + staff._count.auditLogs > 0
  if (hasRecords) {
    // Bookings/payments reference this user — deactivate instead of breaking those records
    await prisma.user.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true, deactivated: true })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
