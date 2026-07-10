import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

const REFUND_TYPES = ['FULL', 'PARTIAL', 'NONE'] as const
const PAYMENT_MODES = ['CASH', 'ONLINE', 'UPI', 'BANK'] as const

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { reason, refundType, refundAmount, refundMode } = body
  // Staff who processed the cancellation; also credited as refund giver when a refund is made
  const staffName = (body.staffName ?? body.refundBy ?? '').trim()

  if (!reason) return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 })
  if (!staffName) return NextResponse.json({ error: 'Staff name is required' }, { status: 400 })
  if (!REFUND_TYPES.includes(refundType)) {
    return NextResponse.json({ error: 'Invalid refund type' }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payments: true },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.cancelled) return NextResponse.json({ error: 'Booking already cancelled' }, { status: 400 })

  // Cancellation is allowed until the end of the checkout day
  const checkoutEnd = new Date(booking.checkout)
  checkoutEnd.setHours(23, 59, 59, 999)
  if (new Date() > checkoutEnd) {
    return NextResponse.json({ error: 'Booking cannot be cancelled — checkout date has passed' }, { status: 400 })
  }

  const totalPaid = booking.advance + booking.payments.reduce((s, p) => s + p.amount, 0)

  let refund = 0
  if (refundType === 'FULL') refund = totalPaid
  else if (refundType === 'PARTIAL') {
    refund = Number(refundAmount)
    if (!refund || refund <= 0) {
      return NextResponse.json({ error: 'Enter a valid refund amount' }, { status: 400 })
    }
    if (refund > totalPaid) {
      return NextResponse.json({ error: `Refund cannot exceed amount paid (₹${totalPaid.toLocaleString('en-IN')})` }, { status: 400 })
    }
  }

  if (refund > 0 && !PAYMENT_MODES.includes(refundMode)) {
    return NextResponse.json({ error: 'Select refund payment mode' }, { status: 400 })
  }

  const cancelledAt = new Date()

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      cancelled: true,
      cancelledAt,
      cancelledBy: staffName,
      cancellationReason: reason,
      refundType,
      refundAmount: refund,
      refundMode: refund > 0 ? refundMode : null,
      refundBy: refund > 0 ? staffName : null,
    },
  })

  // Refund automatically reflects as a hotel expense
  if (refund > 0) {
    await prisma.expense.create({
      data: {
        date: cancelledAt,
        hotelId: booking.hotelId,
        category: 'Refund',
        description: `Refund for cancelled booking ${booking.bookingRef} (${booking.guestName})`,
        amount: refund,
        spentBy: staffName,
        paymentMode: refundMode,
        bookingId: booking.id,
        createdById: session.userId,
      },
    })
  }

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      bookingId: booking.id,
      action: `Cancelled booking ${booking.bookingRef} (${booking.guestName}) — ${refundType === 'NONE' ? 'no refund' : `${refundType.toLowerCase()} refund ₹${refund.toLocaleString('en-IN')}`}. Reason: ${reason}`,
    },
  })

  return NextResponse.json(updated)
}
