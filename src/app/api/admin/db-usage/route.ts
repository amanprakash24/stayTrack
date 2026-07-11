import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Neon free plan storage limit
const LIMIT_BYTES = 500 * 1024 * 1024

export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [{ size }] = await prisma.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) AS size
    `
    const tables = await prisma.$queryRaw<{ name: string; size: bigint; rows: bigint }[]>`
      SELECT relname::text AS name,
             pg_total_relation_size(c.oid) AS size,
             COALESCE(c.reltuples, 0)::bigint AS rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `
    const counts = await prisma.$queryRaw<{ bookings: bigint; payments: bigint; expenses: bigint; logs: bigint }[]>`
      SELECT (SELECT count(*) FROM "Booking") AS bookings,
             (SELECT count(*) FROM "Payment") AS payments,
             (SELECT count(*) FROM "Expense") AS expenses,
             (SELECT count(*) FROM "AuditLog") AS logs
    `

    const usedBytes = Number(size)
    return NextResponse.json({
      usedBytes,
      limitBytes: LIMIT_BYTES,
      freeBytes: Math.max(0, LIMIT_BYTES - usedBytes),
      percentUsed: Math.min(100, Math.round((usedBytes / LIMIT_BYTES) * 1000) / 10),
      tables: tables.map(t => ({ name: t.name, bytes: Number(t.size), rows: Number(t.rows) })),
      counts: {
        bookings: Number(counts[0].bookings),
        payments: Number(counts[0].payments),
        expenses: Number(counts[0].expenses),
        auditLogs: Number(counts[0].logs),
      },
    })
  } catch (e) {
    console.error('[GET /api/admin/db-usage]', e)
    return NextResponse.json({ error: 'Failed to read database size' }, { status: 500 })
  }
}
