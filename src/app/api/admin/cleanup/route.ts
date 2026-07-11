import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Deletes old data in a date range to free DB space (admin only).
// Bookings: only completed (checkout passed) or cancelled ones, matched by checkout date.
// Payments are removed with their booking (cascade). Expenses matched by expense date,
// audit logs by log date. dryRun returns the counts without deleting anything.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { from, to, dryRun } = await req.json()
  if (!from || !to) {
    return NextResponse.json({ error: 'From and to dates are required' }, { status: 400 })
  }

  const fromDate = new Date(from)
  fromDate.setHours(0, 0, 0, 0)
  const toDate = new Date(to)
  toDate.setHours(23, 59, 59, 999)
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || toDate < fromDate) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  const now = new Date()
  const bookingWhere = {
    checkout: { gte: fromDate, lte: toDate },
    // never touch upcoming or ongoing stays
    OR: [{ cancelled: true }, { checkout: { lt: now } }],
  }
  const expenseWhere = { date: { gte: fromDate, lte: toDate } }
  const logWhere = { createdAt: { gte: fromDate, lte: toDate } }

  const [bookings, payments, expenses, auditLogs] = await Promise.all([
    prisma.booking.count({ where: bookingWhere }),
    prisma.payment.count({ where: { booking: bookingWhere } }),
    prisma.expense.count({ where: expenseWhere }),
    prisma.auditLog.count({ where: logWhere }),
  ])

  if (dryRun) {
    // Full record details so admin can review and download an Excel backup before deleting
    const [bookingRecords, expenseRecords, logRecords] = await Promise.all([
      prisma.booking.findMany({
        where: bookingWhere,
        include: {
          hotel: { select: { name: true, location: true } },
          createdBy: { select: { name: true } },
          payments: { select: { amount: true, mode: true, receivedBy: true, note: true, createdAt: true } },
        },
        orderBy: { checkout: 'asc' },
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        include: { hotel: { select: { name: true, location: true } }, booking: { select: { bookingRef: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: logWhere,
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return NextResponse.json({
      dryRun: true, bookings, payments, expenses, auditLogs,
      records: {
        bookings: bookingRecords.map(b => ({
          bookingRef: b.bookingRef,
          guestName: b.guestName,
          phone: b.phone,
          hotel: b.hotel.name,
          location: b.hotel.location,
          checkin: b.checkin,
          checkout: b.checkout,
          planType: b.planType,
          guests: b.guests,
          rooms: b.rooms,
          totalCost: b.totalCost,
          advance: b.advance,
          totalPaid: b.advance + b.payments.reduce((s, p) => s + p.amount, 0),
          status: b.cancelled ? 'CANCELLED' : b.status,
          refundAmount: b.refundAmount,
          bookedBy: b.bookedBy ?? '',
          createdBy: b.createdBy.name,
          notes: b.notes,
          payments: b.payments.map(p => ({
            bookingRef: b.bookingRef,
            guestName: b.guestName,
            amount: p.amount,
            mode: p.mode,
            receivedBy: p.receivedBy,
            note: p.note,
            date: p.createdAt,
          })),
        })),
        expenses: expenseRecords.map(e => ({
          date: e.date,
          hotel: e.hotel.name,
          location: e.hotel.location,
          category: e.category,
          description: e.description,
          amount: e.amount,
          spentBy: e.spentBy,
          paymentMode: e.paymentMode,
          bookingRef: e.booking?.bookingRef ?? '',
        })),
        auditLogs: logRecords.map(l => ({
          date: l.createdAt,
          user: l.user.name,
          action: l.action,
        })),
      },
    })
  }

  // Expenses and audit logs first (their booking links become dangling SetNull otherwise anyway);
  // payments cascade with bookings.
  await prisma.$transaction([
    prisma.expense.deleteMany({ where: expenseWhere }),
    prisma.auditLog.deleteMany({ where: logWhere }),
    prisma.booking.deleteMany({ where: bookingWhere }),
  ])

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `Cleared old data ${from} → ${to}: ${bookings} booking(s), ${payments} payment(s), ${expenses} expense(s), ${auditLogs} log(s)`,
    },
  })

  return NextResponse.json({ dryRun: false, bookings, payments, expenses, auditLogs })
}
