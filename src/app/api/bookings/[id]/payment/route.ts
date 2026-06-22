import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { computeStatus, totalPaid, fmtINR } from '@/lib/utils'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { amount, note, markFullyPaid } = await req.json()

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { payments: true },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
