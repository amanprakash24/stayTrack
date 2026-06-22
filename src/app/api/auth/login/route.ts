import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, cookieName } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { name, password } = await req.json()

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password required' }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, active: true },
    })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = await signToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      location: user.location,
    })

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, role: user.role, location: user.location },
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
