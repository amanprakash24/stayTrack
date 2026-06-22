'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User { id: string; name: string; role: string; location?: string | null }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user) setUser(d.user)
      else router.push('/login')
    }).catch(() => router.push('/login'))
  }, [router])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const navItems = [
    { href: '/bookings', label: 'Bookings', icon: BookingsIcon },
    { href: '/add', label: 'Add', icon: AddIcon },
    { href: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
    { href: '/history', label: 'History', icon: HistoryIcon },
    ...(user?.role === 'SUPERADMIN' ? [{ href: '/admin', label: 'Admin', icon: AdminIcon }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#F4F7F5' }}>
      {/* Topbar */}
      <div style={{
        background: '#1B3A2D',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: '56px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Stay<span style={{ color: '#C9A84C' }}>Track</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user && (
            <div style={{
              background: 'rgba(201,168,76,0.2)',
              border: '1px solid #C9A84C',
              color: '#C9A84C',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {user.name}{user.location ? ` · ${user.location}` : ''}
              {user.role === 'SUPERADMIN' ? ' · Admin' : ''}
            </div>
          )}
          <button
            onClick={logout}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '16px 16px 84px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        {children}
      </div>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#fff',
        borderTop: '1.5px solid #D1DDD4',
        display: 'flex',
        zIndex: 100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.07)',
      }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 0 8px',
                cursor: 'pointer',
                color: active ? '#1B3A2D' : '#718096',
                fontSize: '10px',
                fontWeight: 500,
                gap: '4px',
                border: 'none',
                background: 'none',
                fontFamily: 'Inter, sans-serif',
                transition: 'color 0.15s',
              }}
            >
              <Icon active={active} />
              {label}
              {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#1B3A2D' }} />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function BookingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function AddIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
    </svg>
  )
}
function AnalyticsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 3v18h18" /><path d="M7 16l4-4 4 4 4-4" />
    </svg>
  )
}
function HistoryIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
function AdminIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
