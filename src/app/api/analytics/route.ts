import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role === 'STAFF') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const hotelId = searchParams.get('hotelId') || undefined
  const hotelFilter = hotelId ? { legs: { some: { hotelId } } } : {}

  let fromDate: Date
  let toDate: Date

  if (fromParam && toParam) {
    fromDate = new Date(fromParam)
    fromDate.setHours(0, 0, 0, 0)
    toDate = new Date(toParam)
    toDate.setHours(23, 59, 59, 999)
  } else {
    // default: 3 months
    toDate = new Date()
    toDate.setHours(23, 59, 59, 999)
    fromDate = new Date()
    fromDate.setMonth(fromDate.getMonth() - 2)
    fromDate.setDate(1)
    fromDate.setHours(0, 0, 0, 0)
  }

  const [bookings, cancelledInPeriod, expenses, hotels] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate }, ...hotelFilter },
      include: {
        legs: { include: { hotel: { select: { id: true, location: true, name: true } } }, orderBy: { order: 'asc' } },
        createdBy: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Cancelled during the period (may have been created earlier)
    prisma.booking.findMany({
      where: { cancelled: true, cancelledAt: { gte: fromDate, lte: toDate }, ...hotelFilter },
      select: { id: true, refundAmount: true, legs: { select: { hotelId: true }, orderBy: { order: 'asc' } } },
    }),
    prisma.expense.findMany({
      where: { date: { gte: fromDate, lte: toDate }, hotelId },
      include: {
        hotel: { select: { id: true, name: true, location: true } },
        booking: { select: { bookingRef: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.hotel.findMany({
      // Deactivated hotels stay out of the summary
      where: hotelId ? { id: hotelId } : { active: true },
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const paidOf = (b: { advance: number; payments: { amount: number }[] }) =>
    b.advance + b.payments.reduce((s, p) => s + p.amount, 0)

  // A booking's total cost may span several hotels; a shared payment is allocated to
  // each hotel in proportion to that hotel's share of the booking's total cost.
  const hotelShareOf = (booking: { legs: { hotelId: string; totalCost: number }[] }, hId: string) =>
    booking.legs.filter((l) => l.hotelId === hId).reduce((s, l) => s + l.totalCost, 0)
  const paidAllocatedTo = (
    booking: { legs: { hotelId: string; totalCost: number }[]; totalCost: number },
    hId: string,
    paid: number
  ) => (booking.totalCost > 0 ? paid * (hotelShareOf(booking, hId) / booking.totalCost) : 0)

  // Monthly buckets between fromDate and toDate
  const monthMap: Record<string, { revenue: number; bookings: number; collected: number; expenses: number }> = {}
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  const endMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1)
  while (cursor <= endMonth) {
    const key = cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    monthMap[key] = { revenue: 0, bookings: 0, collected: 0, expenses: 0 }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const activeBookings = bookings.filter(b => !b.cancelled)
  // One row per hotel stay — the natural unit for occupancy/revenue-by-hotel.
  const legRows = activeBookings.flatMap(b => b.legs.map(l => ({ ...l, booking: b })))

  activeBookings.forEach(b => {
    const key = new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    if (monthMap[key]) {
      monthMap[key].revenue += b.totalCost
      monthMap[key].bookings += 1
      monthMap[key].collected += paidOf(b)
    }
  })

  expenses.forEach(e => {
    const key = new Date(e.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    if (monthMap[key]) monthMap[key].expenses += e.amount
  })

  const locationMap: Record<string, number> = {}
  legRows.forEach(l => {
    const loc = l.hotel.location
    locationMap[loc] = (locationMap[loc] ?? 0) + l.totalCost
  })

  const partnerMap: Record<string, number> = {}
  activeBookings.forEach(b => {
    const name = b.createdBy.name
    partnerMap[name] = (partnerMap[name] ?? 0) + 1
  })

  // Income counts all money collected in-period (incl. from later-cancelled bookings);
  // refunds show up on the expense side, so net stays cash-accurate.
  const totalRevenue = activeBookings.reduce((s, b) => s + b.totalCost, 0)
  const totalCollected = bookings.reduce((s, b) => s + paidOf(b), 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalRefunds = cancelledInPeriod.reduce((s, b) => s + b.refundAmount, 0)

  // Per-hotel breakdown
  const hotelSummary = hotels.map(h => {
    const hotelLegs = legRows.filter(l => l.hotelId === h.id)
    const income = bookings.reduce((s, b) => s + paidAllocatedTo(b, h.id, paidOf(b)), 0)
    const exp = expenses.filter(e => e.hotel.id === h.id).reduce((s, e) => s + e.amount, 0)
    const refundTotal = expenses
      .filter(e => e.category === 'Refund' && e.hotel.id === h.id)
      .reduce((s, e) => s + e.amount, 0)
    const cancelledCount = cancelledInPeriod.filter(b => b.legs[0]?.hotelId === h.id).length
    return {
      hotelId: h.id,
      name: h.name,
      location: h.location,
      bookings: hotelLegs.length,
      revenue: hotelLegs.reduce((s, l) => s + l.totalCost, 0),
      income,
      expenses: exp,
      net: income - exp,
      cancelledCount,
      refundTotal,
    }
  })

  return NextResponse.json({
    months: Object.entries(monthMap).map(([label, data]) => ({ label, ...data })),
    locations: Object.entries(locationMap).map(([name, revenue]) => ({ name, revenue })),
    partners: Object.entries(partnerMap).map(([name, count]) => ({ name, count })),
    totals: {
      revenue: totalRevenue,
      bookings: activeBookings.length,
      collected: totalCollected,
      outstanding: activeBookings.reduce((s, b) => s + Math.max(0, b.totalCost - paidOf(b)), 0),
      expenses: totalExpenses,
      net: totalCollected - totalExpenses,
      cancelledBookings: cancelledInPeriod.length,
      refunds: totalRefunds,
    },
    hotelSummary,
    rawBookings: bookings.flatMap(b => b.legs.map(l => ({
      bookingRef: b.bookingRef,
      guestName: b.guestName,
      phone: b.phone,
      legNo: l.order + 1,
      totalLegs: b.legs.length,
      location: l.hotel.location,
      hotel: l.hotel.name,
      legTotalCost: l.totalCost,
      bookingTotalCost: b.totalCost,
      advance: b.advance,
      paid: paidOf(b),
      pending: b.cancelled ? 0 : Math.max(0, b.totalCost - paidOf(b)),
      status: b.cancelled ? 'CANCELLED' : b.status,
      checkin: l.checkin,
      checkout: l.checkout,
      createdBy: b.bookedBy ?? b.createdBy.name,
      planType: l.planType,
    }))),
    rawExpenses: expenses.map(e => ({
      date: e.date,
      hotel: e.hotel.name,
      location: e.hotel.location,
      category: e.category,
      description: e.description ?? '',
      amount: e.amount,
      spentBy: e.spentBy,
      paymentMode: e.paymentMode,
      bookingRef: e.booking?.bookingRef ?? '',
    })),
  })
}
