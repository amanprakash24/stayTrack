import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

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

  const bookings = await prisma.booking.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
    include: {
      hotel: { select: { location: true, name: true } },
      createdBy: { select: { name: true } },
      payments: { select: { amount: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Generate monthly buckets between fromDate and toDate
  const monthMap: Record<string, { revenue: number; bookings: number; collected: number }> = {}
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1)
  const endMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 1)
  while (cursor <= endMonth) {
    const key = cursor.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    monthMap[key] = { revenue: 0, bookings: 0, collected: 0 }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  bookings.forEach(b => {
    const key = new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    if (monthMap[key]) {
      monthMap[key].revenue += b.totalCost
      monthMap[key].bookings += 1
      const paid = b.advance + b.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
      monthMap[key].collected += paid
    }
  })

  const locationMap: Record<string, number> = {}
  bookings.forEach(b => {
    const loc = b.hotel.location
    locationMap[loc] = (locationMap[loc] ?? 0) + b.totalCost
  })

  const partnerMap: Record<string, number> = {}
  bookings.forEach(b => {
    const name = b.createdBy.name
    partnerMap[name] = (partnerMap[name] ?? 0) + 1
  })

  const totalRevenue = bookings.reduce((s: number, b: { totalCost: number }) => s + b.totalCost, 0)
  const totalCollected = bookings.reduce((s: number, b: { advance: number; payments: { amount: number }[] }) => {
    return s + b.advance + b.payments.reduce((ps: number, p: { amount: number }) => ps + p.amount, 0)
  }, 0)

  return NextResponse.json({
    months: Object.entries(monthMap).map(([label, data]) => ({ label, ...data })),
    locations: Object.entries(locationMap).map(([name, revenue]) => ({ name, revenue })),
    partners: Object.entries(partnerMap).map(([name, count]) => ({ name, count })),
    totals: {
      revenue: totalRevenue,
      bookings: bookings.length,
      collected: totalCollected,
      outstanding: totalRevenue - totalCollected,
    },
    rawBookings: bookings.map(b => ({
      bookingRef: b.bookingRef,
      guestName: b.guestName,
      phone: b.phone,
      location: b.hotel.location,
      hotel: b.hotel.name,
      totalCost: b.totalCost,
      advance: b.advance,
      paid: b.advance + b.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0),
      pending: Math.max(0, b.totalCost - b.advance - b.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)),
      status: b.status,
      checkin: b.checkin,
      checkout: b.checkout,
      createdBy: b.createdBy.name,
      planType: b.planType,
    })),
  })
}
