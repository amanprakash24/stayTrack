import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint — hotels that have an active staff account, for the staff login dropdown
export async function GET() {
  try {
    const staff = await prisma.user.findMany({
      where: { role: 'STAFF', active: true, hotel: { active: true } },
      select: { hotel: { select: { id: true, name: true, location: true } } },
      orderBy: { hotel: { name: 'asc' } },
    })
    return NextResponse.json(staff.map(s => s.hotel).filter(Boolean))
  } catch {
    return NextResponse.json([])
  }
}
