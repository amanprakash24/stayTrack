import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calcSubtotal, computeStatus } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'
  const search = searchParams.get('search') ?? ''
  const location = searchParams.get('location') ?? ''

  const where: Record<string, unknown> = {}

  // Staff only see bookings of their own hotel
  if (session.role === 'STAFF') {
    if (!session.hotelId) return NextResponse.json([], { status: 200 })
    where.hotelId = session.hotelId
  }

  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { bookingRef: { contains: search, mode: 'insensitive' } },
      { hotel: { name: { contains: search, mode: 'insensitive' } } },
    ]
  }

  if (location) {
    where.hotel = { location: { equals: location, mode: 'insensitive' } }
  }

  if (filter === 'paid') { where.status = 'PAID'; where.cancelled = false }
  else if (filter === 'partial') { where.status = 'PARTIAL'; where.cancelled = false }
  else if (filter === 'pending') { where.status = 'PENDING'; where.cancelled = false }
  else if (filter === 'cancelled') where.cancelled = true

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      hotel: { select: { id: true, name: true, location: true } },
      createdBy: { select: { id: true, name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(bookings)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    guestName, phone, email, address,
    hotelId, checkin, checkout,
    planType, roomType, guests, rooms, ratePerUnit,
    taxPercent, advance, notes,
    advanceMode, advanceReceivedBy, bookedBy,
  } = body

  if (!guestName || !phone || !hotelId || !checkin || !checkout || !planType || !ratePerUnit) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!bookedBy?.trim()) {
    return NextResponse.json({ error: 'Booked By (staff/partner name) is required' }, { status: 400 })
  }

  // Staff can only create bookings for their own hotel
  if (session.role === 'STAFF' && hotelId !== session.hotelId) {
    return NextResponse.json({ error: 'You can only add bookings for your own hotel' }, { status: 403 })
  }

  const checkinDate = new Date(checkin)
  const checkoutDate = new Date(checkout)
  if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 })
  }
  if (checkoutDate <= checkinDate) {
    return NextResponse.json({ error: 'Check-out date must be after check-in date' }, { status: 400 })
  }
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  if (checkinDate < todayStart) {
    return NextResponse.json({ error: 'Check-in date cannot be in the past' }, { status: 400 })
  }
  const nights = Math.max(1, Math.round((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)))

  const numRooms = Number(rooms) || 1
  const numGuests = Number(guests) || 1
  const rate = Number(ratePerUnit)
  const tax = Number(taxPercent) || 0
  const adv = Number(advance) || 0

  // Any money received must record who took it and how
  if (adv > 0 && (!advanceMode || !advanceReceivedBy?.trim())) {
    return NextResponse.json({ error: 'Payment mode and receiver name are required for the advance' }, { status: 400 })
  }

  const subtotal = calcSubtotal(planType, numGuests, numRooms, rate, nights)
  const taxAmount = Math.round(subtotal * tax / 100)
  const totalCost = subtotal + taxAmount

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } })
  if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

  const overlapping = await prisma.booking.findMany({
    where: {
      hotelId,
      cancelled: false,
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

  // Hotel-wise booking number: BK-<hotel code>-<per-hotel serial>
  const seqHotel = await prisma.hotel.update({
    where: { id: hotelId },
    data: { bookingSeq: { increment: 1 } },
    select: { code: true, bookingSeq: true },
  })
  const bookingRef = `BK-${seqHotel.code ?? '000'}-${String(seqHotel.bookingSeq).padStart(4, '0')}`

  const status = computeStatus(totalCost, adv)

  const booking = await prisma.booking.create({
    data: {
      bookingRef,
      guestName, phone,
      email: email || null,
      address: address || null,
      hotelId,
      checkin: checkinDate,
      checkout: checkoutDate,
      planType,
      roomType: ['STANDARD', 'DELUXE'].includes(roomType) ? roomType : null,
      guests: numGuests,
      rooms: numRooms,
      ratePerUnit: rate,
      subtotal,
      taxPercent: tax,
      taxAmount,
      totalCost,
      advance: adv,
      advanceMode: adv > 0 ? advanceMode : null,
      advanceReceivedBy: adv > 0 ? advanceReceivedBy.trim() : null,
      status,
      notes: notes || null,
      bookedBy: bookedBy.trim(),
      createdById: session.userId,
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
      bookingId: booking.id,
      action: `Created booking ${bookingRef} for ${guestName} (booked by ${bookedBy.trim()})`,
    },
  })

  return NextResponse.json(booking, { status: 201 })
}
