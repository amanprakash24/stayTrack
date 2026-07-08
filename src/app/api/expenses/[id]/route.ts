import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { hotel: { select: { name: true } } },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.role !== 'SUPERADMIN' && expense.createdById !== session.userId) {
    return NextResponse.json({ error: 'You can only delete expenses you added' }, { status: 403 })
  }

  await prisma.expense.delete({ where: { id } })

  await prisma.auditLog.create({
    data: {
      userId: session.userId,
      action: `Deleted expense ₹${expense.amount.toLocaleString('en-IN')} (${expense.category}) of ${expense.hotel.name}`,
    },
  })

  return NextResponse.json({ ok: true })
}
