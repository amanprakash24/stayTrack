import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { computeStatus, totalPaid, fmtINR } from '@/lib/utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { amount, note, markFullyPaid, mode, receivedBy } = await req.json()

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payments: true },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.role === 'STAFF' && booking.hotelId !== session.hotelId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.cancelled) return NextResponse.json({ error: 'Booking is cancelled' }, { status: 400 })

  // Who took the payment and how is always mandatory
  if (!mode) return NextResponse.json({ error: 'Payment mode is required' }, { status: 400 })
  if (!receivedBy?.trim()) return NextResponse.json({ error: 'Receiver (staff) name is required' }, { status: 400 })

  let payAmount = Number(amount)

  if (markFullyPaid) {
    const paid = totalPaid(booking.advance, booking.payments)
    payAmount = booking.totalCost - paid
    if (payAmount <= 0) {
      return NextResponse.json({ error: 'Booking already fully paid' }, { status: 400 })
    }
  }

  if (!payAmount || payAmount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  await prisma.payment.create({
    data: {
      bookingId: id,
      amount: payAmount,
      mode,
      receivedBy: receivedBy.trim(),
      note: note || null,
      recordedById: session.userId,
    },
  })

  const allPayments = [...booking.payments, { amount: payAmount }]
  const newPaid = totalPaid(booking.advance, allPayments)
  const newStatus = computeStatus(booking.totalCost, newPaid)

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: newStatus },
  })

  const actionLabel = markFullyPaid
    ? `Marked booking fully paid (cleared ₹${fmtINR(payAmount)} balance)`
    : `Added payment of ${fmtINR(payAmount)}`

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      bookingId: id,
      action: `${actionLabel} on ${booking.bookingRef} (${booking.guestName})`,
    },
  })

  return NextResponse.json({ status: updated.status, totalPaid: newPaid })
}
