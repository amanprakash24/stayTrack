import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const hotelId = searchParams.get('hotelId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (hotelId) where.hotelId = hotelId
  // Staff only see expenses of their own hotel
  if (session.role === 'STAFF') where.hotelId = session.hotelId ?? ''
  if (from || to) {
    const date: Record<string, Date> = {}
    if (from) {
      const f = new Date(from); f.setHours(0, 0, 0, 0); date.gte = f
    }
    if (to) {
      const t = new Date(to); t.setHours(23, 59, 59, 999); date.lte = t
    }
    where.date = date
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      hotel: { select: { id: true, name: true, location: true } },
      createdBy: { select: { name: true } },
      booking: { select: { bookingRef: true } },
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, hotelId, category, description, amount, spentBy, paymentMode } = await req.json()

  if (!date || !hotelId || !category || !amount || !spentBy || !paymentMode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (session.role === 'STAFF' && hotelId !== session.hotelId) {
    return NextResponse.json({ error: 'You can only add expenses for your own hotel' }, { status: 403 })
  }
  const amt = Number(amount)
  if (!amt || amt <= 0) {
    return NextResponse.json({ error: 'Enter a valid amount' }, { status: 400 })
  }
  const expenseDate = new Date(date)
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  if (isNaN(expenseDate.getTime()) || expenseDate > endOfToday) {
    return NextResponse.json({ error: 'Expense date cannot be in the future' }, { status: 400 })
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } })
  if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })

  const expense = await prisma.expense.create({
    data: {
      date: new Date(date),
      hotelId,
      category,
      description: description || null,
      amount: amt,
      spentBy,
      paymentMode,
      createdById: session.userId,
    },
    include: {
      hotel: { select: { id: true, name: true, location: true } },
      createdBy: { select: { name: true } },
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `Added expense ₹${amt.toLocaleString('en-IN')} (${category}) for ${hotel.name} — spent by ${spentBy}`,
    },
  })

  return NextResponse.json(expense, { status: 201 })
}
