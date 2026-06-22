import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Public endpoint — returns only partner names for the login dropdown
export async function GET() {
  try {
    const partners = await prisma.user.findMany({
      where: { role: 'PARTNER', active: true },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(partners.map(p => p.name))
  } catch {
    return NextResponse.json([])
  }
}
