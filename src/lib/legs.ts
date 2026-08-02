import { calcSubtotal } from './utils'

export class LegValidationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface LegInput {
  id?: string
  hotelId: string
  checkin: string
  checkout: string
  planType: string
  roomType?: string | null
  guests: number | string
  childGuests?: number | string
  childRate?: number | string
  rooms: number | string
  ratePerUnit: number | string
  taxPercent?: number | string
}

export interface ComputedLeg {
  id?: string
  hotelId: string
  checkinDate: Date
  checkoutDate: Date
  planType: string
  roomType: string | null
  guests: number
  childGuests: number
  childRate: number
  rooms: number
  ratePerUnit: number
  taxPercent: number
  subtotal: number
  taxAmount: number
  totalCost: number
}

/** Validates and prices one hotel-stay leg. Shared by booking create and edit. */
export function computeLeg(input: LegInput, opts: { allowPastCheckin?: boolean } = {}): ComputedLeg {
  const { hotelId, checkin, checkout, planType, ratePerUnit } = input
  if (!hotelId || !checkin || !checkout || !planType || !ratePerUnit) {
    throw new LegValidationError('Each stay needs a hotel, dates, plan, and rate')
  }

  const checkinDate = new Date(checkin)
  const checkoutDate = new Date(checkout)
  if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
    throw new LegValidationError('Invalid dates')
  }
  if (checkoutDate <= checkinDate) {
    throw new LegValidationError('Check-out date must be after check-in date')
  }
  if (!opts.allowPastCheckin) {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    if (checkinDate < todayStart) {
      throw new LegValidationError('Check-in date cannot be in the past')
    }
  }

  const nights = Math.max(1, Math.round((checkoutDate.getTime() - checkinDate.getTime()) / (1000 * 60 * 60 * 24)))
  const numRooms = Number(input.rooms) || 1
  const numGuests = Number(input.guests) || 1
  const numChildren = Math.max(0, Number(input.childGuests) || 0)
  const chRate = numChildren > 0 ? Math.max(0, Number(input.childRate) || 0) : 0
  const rate = Number(ratePerUnit)
  const tax = Number(input.taxPercent) || 0

  const subtotal = calcSubtotal(planType, numGuests, numRooms, rate, nights) + numChildren * chRate * nights
  const taxAmount = Math.round(subtotal * tax / 100)
  const totalCost = subtotal + taxAmount

  return {
    id: input.id,
    hotelId,
    checkinDate,
    checkoutDate,
    planType,
    roomType: input.roomType && ['STANDARD', 'DELUXE'].includes(input.roomType) ? input.roomType : null,
    guests: numGuests,
    childGuests: numChildren,
    childRate: chRate,
    rooms: numRooms,
    ratePerUnit: rate,
    taxPercent: tax,
    subtotal,
    taxAmount,
    totalCost,
  }
}

export function legsOverlap(a: { checkinDate: Date; checkoutDate: Date }, b: { checkinDate: Date; checkoutDate: Date }) {
  return a.checkinDate < b.checkoutDate && b.checkinDate < a.checkoutDate
}

export function sumLegTotals(legs: { subtotal: number; taxAmount: number; totalCost: number }[]) {
  return legs.reduce(
    (acc, l) => ({
      subtotal: acc.subtotal + l.subtotal,
      taxAmount: acc.taxAmount + l.taxAmount,
      totalCost: acc.totalCost + l.totalCost,
    }),
    { subtotal: 0, taxAmount: 0, totalCost: 0 }
  )
}
