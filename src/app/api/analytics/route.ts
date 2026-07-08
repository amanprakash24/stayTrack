import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const hotelId = searchParams.get('hotelId') || undefined

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
      where: { createdAt: { gte: fromDate, lte: toDate }, hotelId },
      include: {
        hotel: { select: { id: true, location: true, name: true } },
        createdBy: { select: { name: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Cancelled during the period (may have been created earlier)
    prisma.booking.findMany({
      where: { cancelled: true, cancelledAt: { gte: fromDate, lte: toDate }, hotelId },
      select: { id: true, hotelId: true, refundAmount: true },
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
      where: hotelId ? { id: hotelId } : undefined,
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const paidOf = (b: { advance: number; payments: { amount: number }[] }) =>
    b.advance + b.payments.reduce((s, p) => s + p.amount, 0)

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
  activeBookings.forEach(b => {
    const loc = b.hotel.location
    locationMap[loc] = (locationMap[loc] ?? 0) + b.totalCost
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
    const hb = activeBookings.filter(b => b.hotel.id === h.id)
    const income = bookings.filter(b => b.hotel.id === h.id).reduce((s, b) => s + paidOf(b), 0)
    const exp = expenses.filter(e => e.hotel.id === h.id).reduce((s, e) => s + e.amount, 0)
    const cancelled = cancelledInPeriod.filter(b => b.hotelId === h.id)
    return {
      hotelId: h.id,
      name: h.name,
      location: h.location,
      bookings: hb.length,
      revenue: hb.reduce((s, b) => s + b.totalCost, 0),
      income,
      expenses: exp,
      net: income - exp,
      cancelledCount: cancelled.length,
      refundTotal: cancelled.reduce((s, b) => s + b.refundAmount, 0),
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
    rawBookings: bookings.map(b => ({
      bookingRef: b.bookingRef,
      guestName: b.guestName,
      phone: b.phone,
      location: b.hotel.location,
      hotel: b.hotel.name,
      totalCost: b.totalCost,
      advance: b.advance,
      paid: paidOf(b),
      pending: b.cancelled ? 0 : Math.max(0, b.totalCost - paidOf(b)),
      status: b.cancelled ? 'CANCELLED' : b.status,
      checkin: b.checkin,
      checkout: b.checkout,
      createdBy: b.createdBy.name,
      planType: b.planType,
    })),
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
