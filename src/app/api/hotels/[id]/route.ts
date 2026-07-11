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

  // If a room-type split is given, it must add up to the total
  const existing = await prisma.hotel.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })
  const effTotal = data.totalRooms ? Number(data.totalRooms) : existing.totalRooms
  const effStd = data.standardRooms !== undefined ? (Number(data.standardRooms) || 0) : (existing.standardRooms ?? 0)
  const effDlx = data.deluxeRooms !== undefined ? (Number(data.deluxeRooms) || 0) : (existing.deluxeRooms ?? 0)
  if ((effStd || effDlx) && effStd + effDlx !== effTotal) {
    return NextResponse.json({ error: `Standard + Deluxe rooms (${effStd + effDlx}) must equal total rooms (${effTotal})` }, { status: 400 })
  }

  const hotel = await prisma.hotel.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      location: data.location ?? undefined,
      totalRooms: data.totalRooms ? Number(data.totalRooms) : undefined,
      standardRooms: data.standardRooms !== undefined ? (data.standardRooms ? Number(data.standardRooms) : null) : undefined,
      deluxeRooms: data.deluxeRooms !== undefined ? (data.deluxeRooms ? Number(data.deluxeRooms) : null) : undefined,
      tourismFee: data.tourismFee !== undefined ? (data.tourismFee ? Number(data.tourismFee) : null) : undefined,
      managerName: data.managerName !== undefined ? (data.managerName || null) : undefined,
      managerPhone: data.managerPhone !== undefined ? (data.managerPhone || null) : undefined,
      active: data.active !== undefined ? data.active : undefined,
    },
  })
  return NextResponse.json(hotel)
}

// Permanently deletes the hotel and ALL its data (bookings + payments, expenses,
// related history logs). Staff logins of the hotel are detached and disabled.
// Use PATCH { active: false } for the reversible deactivate instead.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params

  const hotel = await prisma.hotel.findUnique({
    where: { id },
    include: { _count: { select: { bookings: true, expenses: true } } },
  })
  if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { booking: { hotelId: id } } }),
    prisma.expense.deleteMany({ where: { hotelId: id } }),
    prisma.booking.deleteMany({ where: { hotelId: id } }), // payments cascade
    prisma.user.updateMany({ where: { role: 'STAFF', hotelId: id }, data: { active: false, hotelId: null } }),
    prisma.user.updateMany({ where: { role: 'PARTNER', hotelId: id }, data: { hotelId: null } }),
    prisma.hotel.delete({ where: { id } }),
  ])

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `Permanently deleted hotel "${hotel.name.trim()}" with ${hotel._count.bookings} booking(s) and ${hotel._count.expenses} expense(s)`,
    },
  })

  return NextResponse.json({ ok: true, bookings: hotel._count.bookings, expenses: hotel._count.expenses })
}
