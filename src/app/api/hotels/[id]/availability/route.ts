import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const checkin = searchParams.get('checkin')
  const checkout = searchParams.get('checkout')
  const excludeBookingId = searchParams.get('exclude')

  if (!checkin || !checkout) {
    return NextResponse.json({ error: 'checkin and checkout required' }, { status: 400 })
  }

  const hotel = await prisma.hotel.findUnique({ where: { id } })
  if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

  const checkinDate = new Date(checkin)
  const checkoutDate = new Date(checkout)

  const overlappingBookings = await prisma.booking.findMany({
    where: {
      hotelId: id,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      AND: [
        { checkin: { lt: checkoutDate } },
        { checkout: { gt: checkinDate } },
      ],
    },
    select: { rooms: true },
  })

  const bookedRooms = overlappingBookings.reduce((sum: number, b: { rooms: number }) => sum + b.rooms, 0)
  const available = hotel.totalRooms - bookedRooms

  return NextResponse.json({
    totalRooms: hotel.totalRooms,
    bookedRooms,
    available: Math.max(0, available),
    isAvailable: available > 0,
  })
}
