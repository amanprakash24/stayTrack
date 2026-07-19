import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calcSubtotal, computeStatus } from '@/lib/utils'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      hotel: true,
      createdBy: { select: { name: true } },
      payments: { include: { recordedBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      auditLogs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role === 'STAFF' && booking.hotelId !== session.hotelId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(booking)
}

// Edit a booking — admin and partner only. Hotel and advance/payments are not
// editable here (payments have their own endpoints; hotel would break the ref).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'STAFF') {
    return NextResponse.json({ error: 'Only admin or partner can edit bookings' }, { status: 403 })
  }

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payments: { select: { amount: true } } },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.cancelled) {
    return NextResponse.json({ error: 'Cancelled bookings cannot be edited' }, { status: 400 })
  }

  const body = await req.json()
  const {
    guestName, phone, email, address, checkin, checkout,
    planType, roomType, guests, childGuests, childRate, rooms, ratePerUnit,
    taxPercent, notes, bookedBy,
  } = body

  if (!guestName || !phone || !checkin || !checkout || !planType || !ratePerUnit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!bookedBy?.trim()) {
    return NextResponse.json({ error: 'Booked By (staff/partner name) is required' }, { status: 400 })
  }

  const checkinDate = new Date(checkin)
  const checkoutDate = new Date(checkout)
  if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  }
  // No past-date restriction here: ongoing/old bookings must stay editable
  if (checkoutDate <= checkinDate) {
    return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 })
  }
  const nights = Math.max(1, Math.round((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)))

  const numRooms = Number(rooms) || 1
  const numGuests = Number(guests) || 1
  const numChildren = Math.max(0, Number(childGuests) || 0)
  const chRate = numChildren > 0 ? Math.max(0, Number(childRate) || 0) : 0
  const rate = Number(ratePerUnit)
  const tax = Number(taxPercent) || 0

  const hotel = await prisma.hotel.findUnique({ where: { id: booking.hotelId } })
  if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

  const overlapping = await prisma.booking.findMany({
    where: {
      hotelId: booking.hotelId,
      cancelled: false,
      id: { not: id },
      AND: [{ checkin: { lt: checkoutDate } }, { checkout: { gt: checkinDate } }],
    },
    select: { rooms: true },
  })
  const bookedRooms = overlapping.reduce((s: number, b: { rooms: number }) => s + b.rooms, 0)
  if (bookedRooms + numRooms > hotel.totalRooms) {
    return NextResponse.json(
      { error: `Only ${hotel.totalRooms - bookedRooms} room(s) available for these dates` },
      { status: 409 }
    )
  }

  // Children are charged per child per day on top of the plan subtotal
  const subtotal = calcSubtotal(planType, numGuests, numRooms, rate, nights) + numChildren * chRate * nights
  const taxAmount = Math.round(subtotal * tax / 100)
  const totalCost = subtotal + taxAmount
  const paid = booking.advance + booking.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
  const status = computeStatus(totalCost, paid)

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      guestName, phone,
      email: email || null,
      address: address || null,
      checkin: checkinDate,
      checkout: checkoutDate,
      planType,
      roomType: ['STANDARD', 'DELUXE'].includes(roomType) ? roomType : null,
      guests: numGuests,
      childGuests: numChildren,
      childRate: chRate,
      rooms: numRooms,
      ratePerUnit: rate,
      subtotal,
      taxPercent: tax,
      taxAmount,
      totalCost,
      status,
      notes: notes || null,
      bookedBy: bookedBy.trim(),
    },
    include: {
      hotel: { select: { name: true, location: true } },
      createdBy: { select: { name: true } },
      payments: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      bookingId: id,
      action: `Edited booking ${booking.bookingRef} for ${guestName}`,
    },
  })

  return NextResponse.json(updated)
}
