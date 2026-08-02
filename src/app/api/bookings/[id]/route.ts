import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { computeStatus, totalPaid } from '@/lib/utils'
import { computeLeg, legsOverlap, sumLegTotals, LegValidationError, LegInput } from '@/lib/legs'
import { assertRoomsAvailable, AvailabilityError } from '@/lib/availability'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      legs: { include: { hotel: true }, orderBy: { order: 'asc' } },
      createdBy: { select: { name: true } },
      payments: { include: { recordedBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      auditLogs: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
    },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role === 'STAFF' && !booking.legs.some((l) => l.hotelId === session.hotelId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json(booking)
}

// Edit a booking — admin and partner only. Advance/payments are not editable here
// (payments have their own endpoints).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'STAFF') {
    return NextResponse.json({ error: 'Only admin or partner can edit bookings' }, { status: 403 })
  }

  const { id } = await params
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payments: { select: { amount: true } }, legs: true },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.cancelled) {
    return NextResponse.json({ error: 'Cancelled bookings cannot be edited' }, { status: 400 })
  }

  const body: {
    guestName: string; phone: string; email?: string; address?: string; notes?: string; bookedBy: string
    legs: LegInput[]
  } = await req.json()
  const { guestName, phone, email, address, notes, bookedBy, legs: legInputs } = body

  if (!guestName || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!bookedBy?.trim()) {
    return NextResponse.json({ error: 'Booked By (staff/partner name) is required' }, { status: 400 })
  }
  if (!Array.isArray(legInputs) || legInputs.length === 0) {
    return NextResponse.json({ error: 'At least one stay is required' }, { status: 400 })
  }

  const existingLegIds = new Set(booking.legs.map((l) => l.id))

  let computedLegs
  try {
    // Existing legs keep their original checkin-not-in-the-past leniency (ongoing/old
    // bookings must stay editable); brand-new legs added during an edit still can't
    // be booked into the past.
    computedLegs = legInputs.map((l) => computeLeg(l, { allowPastCheckin: Boolean(l.id) }))

    for (let i = 0; i < computedLegs.length; i++) {
      const leg = computedLegs[i]
      const extraRoomsHeld = computedLegs
        .slice(0, i)
        .filter((other) => other.hotelId === leg.hotelId && legsOverlap(other, leg))
        .reduce((sum, other) => sum + other.rooms, 0)
      await assertRoomsAvailable(leg.hotelId, leg.checkinDate, leg.checkoutDate, leg.rooms, leg.id, extraRoomsHeld)
    }
  } catch (e) {
    if (e instanceof LegValidationError || e instanceof AvailabilityError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }

  const incomingIds = new Set(computedLegs.filter((l) => l.id).map((l) => l.id as string))
  const idsToDelete = [...existingLegIds].filter((legId) => !incomingIds.has(legId))

  const { subtotal, taxAmount, totalCost } = sumLegTotals(computedLegs)
  const paid = totalPaid(booking.advance, booking.payments)
  const status = computeStatus(totalCost, paid)

  await prisma.$transaction(async (tx) => {
    if (idsToDelete.length) {
      await tx.bookingLeg.deleteMany({ where: { id: { in: idsToDelete } } })
    }
    for (let i = 0; i < computedLegs.length; i++) {
      const l = computedLegs[i]
      const data = {
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
      }
      if (l.id) {
        await tx.bookingLeg.update({ where: { id: l.id }, data })
      } else {
        await tx.bookingLeg.create({ data: { ...data, bookingId: id } })
      }
    }
    await tx.booking.update({
      where: { id },
      data: {
        guestName, phone,
        email: email || null,
        address: address || null,
        subtotal, taxAmount, totalCost,
        status,
        notes: notes || null,
        bookedBy: bookedBy.trim(),
      },
    })
  })

  const updated = await prisma.booking.findUnique({
    where: { id },
    include: {
      legs: { include: { hotel: { select: { name: true, location: true } } }, orderBy: { order: 'asc' } },
      createdBy: { select: { name: true } },
      payments: true,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      bookingId: id,
      action: `Edited booking ${booking.bookingRef} for ${guestName} (${computedLegs.length} stay${computedLegs.length > 1 ? 's' : ''})`,
    },
  })

  return NextResponse.json(updated)
}
