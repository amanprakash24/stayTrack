import { prisma } from './prisma'

export class AvailabilityError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function bookedRoomsFor(hotelId: string, checkin: Date, checkout: Date, excludeLegId?: string) {
  const overlapping = await prisma.bookingLeg.findMany({
    where: {
      hotelId,
      booking: { cancelled: false },
      id: excludeLegId ? { not: excludeLegId } : undefined,
      AND: [{ checkin: { lt: checkout } }, { checkout: { gt: checkin } }],
    },
    select: { rooms: true },
  })
  return overlapping.reduce((sum: number, l: { rooms: number }) => sum + l.rooms, 0)
}

export async function getAvailability(hotelId: string, checkin: Date, checkout: Date, excludeLegId?: string) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } })
  if (!hotel) throw new AvailabilityError('Hotel not found', 404)

  const bookedRooms = await bookedRoomsFor(hotelId, checkin, checkout, excludeLegId)
  const available = hotel.totalRooms - bookedRooms

  return {
    totalRooms: hotel.totalRooms,
    bookedRooms,
    available: Math.max(0, available),
    isAvailable: available > 0,
  }
}

/**
 * Throws if `roomsNeeded` won't fit. `extraRoomsHeld` accounts for sibling legs in the
 * same in-flight request (same hotel, overlapping dates) that aren't in the DB yet.
 */
export async function assertRoomsAvailable(
  hotelId: string,
  checkin: Date,
  checkout: Date,
  roomsNeeded: number,
  excludeLegId?: string,
  extraRoomsHeld = 0
) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } })
  if (!hotel) throw new AvailabilityError('Hotel not found', 404)

  const bookedRooms = await bookedRoomsFor(hotelId, checkin, checkout, excludeLegId)
  if (bookedRooms + extraRoomsHeld + roomsNeeded > hotel.totalRooms) {
    const remaining = Math.max(0, hotel.totalRooms - bookedRooms - extraRoomsHeld)
    throw new AvailabilityError(`Only ${remaining} room(s) available for these dates`, 409)
  }
}
