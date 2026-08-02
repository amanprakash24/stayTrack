import { NextRequest, NextResponse } from 'next/server'
import { getAvailability, AvailabilityError } from '@/lib/availability'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const checkin = searchParams.get('checkin')
  const checkout = searchParams.get('checkout')
  const excludeLegId = searchParams.get('exclude') ?? undefined

  if (!checkin || !checkout) {
    return NextResponse.json({ error: 'checkin and checkout required' }, { status: 400 })
  }

  try {
    const result = await getAvailability(id, new Date(checkin), new Date(checkout), excludeLegId)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof AvailabilityError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    throw e
  }
}
