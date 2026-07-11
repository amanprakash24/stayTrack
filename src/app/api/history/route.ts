import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logs = await prisma.auditLog.findMany({
    // Staff only see activity of their own hotel (plus their own actions)
    where: session.role === 'STAFF'
      ? { OR: [{ booking: { hotelId: session.hotelId ?? '' } }, { userId: session.userId }] }
      : undefined,
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json(logs)
}
