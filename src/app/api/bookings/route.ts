import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { computeStatus } from '@/lib/utils'
import { computeLeg, legsOverlap, sumLegTotals, LegValidationError, LegInput } from '@/lib/legs'
import { assertRoomsAvailable, AvailabilityError } from '@/lib/availability'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all'
  const search = searchParams.get('search') ?? ''
  const location = searchParams.get('location') ?? ''

  const where: Record<string, unknown> = {}
  // Two independent "does some leg satisfy X" clauses can't share the `legs` key
  // (the second would silently overwrite the first), so combine them via AND.
  const andConditions: Record<string, unknown>[] = []

  // Staff only see bookings that include a stay at their own hotel
  if (session.role === 'STAFF') {
    if (!session.hotelId) return NextResponse.json([], { status: 200 })
    andConditions.push({ legs: { some: { hotelId: session.hotelId } } })
  }

  if (location) {
    andConditions.push({ legs: { some: { hotel: { location: { equals: location, mode: 'insensitive' } } } } })
  }

  if (andConditions.length) where.AND = andConditions

  if (search) {
    where.OR = [
      { guestName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { bookingRef: { contains: search, mode: 'insensitive' } },
      { legs: { some: { hotel: { name: { contains: search, mode: 'insensitive' } } } } },
    ]
  }

  if (filter === 'paid') { where.status = 'PAID'; where.cancelled = false }
  else if (filter === 'partial') { where.status = 'PARTIAL'; where.cancelled = false }
  else if (filter === 'pending') { where.status = 'PENDING'; where.cancelled = false }
  else if (filter === 'cancelled') where.cancelled = true

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      legs: { include: { hotel: { select: { id: true, name: true, location: true } } }, orderBy: { order: 'asc' } },
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

  const body: {
    guestName: string; phone: string; email?: string; address?: string; bookedBy: string; notes?: string
    advance?: number | string; advanceMode?: string; advanceReceivedBy?: string
    legs: LegInput[]
  } = await req.json()
  const {
    guestName, phone, email, address, bookedBy, notes,
    advance, advanceMode, advanceReceivedBy,
    legs: legInputs,
  } = body

  if (!guestName || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!bookedBy?.trim()) {
    return NextResponse.json({ error: 'Booked By (staff/partner name) is required' }, { status: 400 })
  }
  if (!Array.isArray(legInputs) || legInputs.length === 0) {
    return NextResponse.json({ error: 'At least one stay is required' }, { status: 400 })
  }

  // Staff can only create single-property bookings for their own hotel
  if (session.role === 'STAFF') {
    if (legInputs.length > 1) {
      return NextResponse.json({ error: 'Staff accounts can only create single-property bookings' }, { status: 403 })
    }
    if (legInputs[0].hotelId !== session.hotelId) {
      return NextResponse.json({ error: 'You can only add bookings for your own hotel' }, { status: 403 })
    }
  }

  const adv = Number(advance) || 0
  if (adv > 0 && (!advanceMode || !advanceReceivedBy?.trim())) {
    return NextResponse.json({ error: 'Payment mode and receiver name are required for the advance' }, { status: 400 })
  }

  let computedLegs
  try {
    computedLegs = legInputs.map((l) => computeLeg(l))

    for (let i = 0; i < computedLegs.length; i++) {
      const leg = computedLegs[i]
      const extraRoomsHeld = computedLegs
        .slice(0, i)
        .filter((other) => other.hotelId === leg.hotelId && legsOverlap(other, leg))
        .reduce((sum, other) => sum + other.rooms, 0)
      await assertRoomsAvailable(leg.hotelId, leg.checkinDate, leg.checkoutDate, leg.rooms, undefined, extraRoomsHeld)
    }
  } catch (e) {
    if (e instanceof LegValidationError || e instanceof AvailabilityError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }

  const { subtotal, taxAmount, totalCost } = sumLegTotals(computedLegs)
  const status = computeStatus(totalCost, adv)

  // Booking reference is anchored to the first stay's hotel — it's a human-readable
  // label, not a billing key, so the itinerary's starting point is a reasonable anchor.
  const seqHotel = await prisma.hotel.update({
    where: { id: computedLegs[0].hotelId },
    data: { bookingSeq: { increment: 1 } },
    select: { code: true, bookingSeq: true },
  })
  const bookingRef = `BK-${seqHotel.code ?? '000'}-${String(seqHotel.bookingSeq).padStart(4, '0')}`

  const booking = await prisma.booking.create({
    data: {
      bookingRef,
      guestName, phone,
      email: email || null,
      address: address || null,
      subtotal, taxAmount, totalCost,
      advance: adv,
      advanceMode: adv > 0 ? (advanceMode as never) : null,
      advanceReceivedBy: adv > 0 ? (advanceReceivedBy as string).trim() : null,
      status,
      notes: notes || null,
      bookedBy: bookedBy.trim(),
      createdById: session.userId,
      legs: {
        create: computedLegs.map((l, i) => ({
          order: i,
          hotelId: l.hotelId,
          checkin: l.checkinDate,
          checkout: l.checkoutDate,
          planType: l.planType as never,
          roomType: l.roomType,
          guests: l.guests,
          childGuests: l.childGuests,
          childRate: l.childRate,
          rooms: l.rooms,
          ratePerUnit: l.ratePerUnit,
          subtotal: l.subtotal,
          taxPercent: l.taxPercent,
          taxAmount: l.taxAmount,
          totalCost: l.totalCost,
        })),
      },
    },
    include: {
      legs: { include: { hotel: { select: { name: true, location: true } } }, orderBy: { order: 'asc' } },
      createdBy: { select: { name: true } },
      payments: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      bookingId: booking.id,
      action: `Created booking ${bookingRef} for ${guestName} across ${computedLegs.length} propert${computedLegs.length > 1 ? 'ies' : 'y'} (booked by ${bookedBy.trim()})`,
    },
  })

  return NextResponse.json(booking, { status: 201 })
}
