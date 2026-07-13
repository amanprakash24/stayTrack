import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, cookieName } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { name, password, staffHotelId } = await req.json()

    if ((!name && !staffHotelId) || !password) {
      return NextResponse.json({ error: 'Name and password required' }, { status: 400 })
    }

    const envAdminName = process.env.ADMIN_NAME
    const envAdminPassword = process.env.ADMIN_PASSWORD
    const envAdminConfigured = Boolean(envAdminName && envAdminPassword)

    let user
    if (
      !staffHotelId &&
      envAdminConfigured &&
      typeof name === 'string' &&
      name.trim().toLowerCase() === envAdminName!.trim().toLowerCase()
    ) {
      // Admin login via ADMIN_NAME/ADMIN_PASSWORD env vars — the DB password is
      // not consulted, and the superadmin row is created if the DB is fresh.
      if (password !== envAdminPassword) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
      const hashed = await bcrypt.hash(envAdminPassword!, 10)
      user = await prisma.user.upsert({
        where: { id: 'superadmin-seed' },
        update: { name: envAdminName!, password: hashed, active: true },
        create: {
          id: 'superadmin-seed',
          name: envAdminName!,
          password: hashed,
          role: 'SUPERADMIN',
          location: null,
        },
      })
    } else {
      // Staff login: identified by hotel + password (one staff account per hotel).
      // When env admin creds are configured, superadmins can only log in through them.
      user = staffHotelId
        ? await prisma.user.findFirst({
            where: { role: 'STAFF', hotelId: staffHotelId, active: true },
          })
        : await prisma.user.findFirst({
            where: {
              name: { equals: name, mode: 'insensitive' },
              active: true,
              role: envAdminConfigured ? { notIn: ['STAFF', 'SUPERADMIN'] } : { not: 'STAFF' },
            },
          })

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }
    }

    const token = await signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      location: user.location,
      hotelId: user.hotelId,
    })

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role, location: user.location, hotelId: user.hotelId },
    })

    res.cookies.set(cookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return res
  } catch (e) {
    console.error('[POST /api/auth/login]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
