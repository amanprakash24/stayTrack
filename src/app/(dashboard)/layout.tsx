'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User { id: string; name: string; role: string; location?: string | null }
interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setShowIOSHint(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
    setIsIOS(ios)
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installApp() {
    if (isIOS) { setShowIOSHint(h => !h); return }
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstallPrompt(null)
    setMenuOpen(false)
  }

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
    { href: '/availability', label: 'Rooms', icon: RoomsIcon },
    { href: '/expenses', label: 'Expenses', icon: ExpensesIcon },
    // Staff don't get analytics — P&L stays with admin/partners
    ...(user?.role !== 'STAFF' ? [{ href: '/analytics', label: 'Analytics', icon: AnalyticsIcon }] : []),
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
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          Happy <span style={{ color: '#C9A84C' }}>&amp; Panorama</span>
        </div>
        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            {/* Avatar button */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#C9A84C', border: '2px solid rgba(201,168,76,0.4)',
                color: '#1B3A2D', fontFamily: 'Syne, sans-serif',
                fontSize: '14px', fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '44px', right: 0,
                background: '#fff', borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                border: '1px solid #D1DDD4',
                minWidth: '180px', zIndex: 200, overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #EAF0EC' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#1B3A2D' }}>{user.name}</div>
                  <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>
                    {user.role === 'SUPERADMIN' ? 'Super Admin' : user.role === 'STAFF' ? 'Hotel Staff' : 'Partner'}
                    {user.location ? ` · ${user.location}` : ''}
                  </div>
                </div>
                {(installPrompt || isIOS) && (
                  <div style={{ borderTop: '1px solid #EAF0EC' }}>
                    <button
                      onClick={installApp}
                      style={{ width: '100%', padding: '11px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#1B3A2D', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 2v13M8 11l4 4 4-4"/><path d="M3 18v1a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/>
                      </svg>
                      Save App to Phone
                    </button>
                    {isIOS && showIOSHint && (
                      <div style={{ margin: '0 16px 12px', background: '#EAF0EC', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1B3A2D', lineHeight: 1.5 }}>
                        Tap <strong>Share</strong> (↑) at the bottom of Safari, then tap <strong>&quot;Add to Home Screen&quot;</strong>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ borderTop: '1px solid #EAF0EC' }}>
                  <button
                    onClick={() => { setMenuOpen(false); logout() }}
                    style={{ width: '100%', padding: '11px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#C0392B', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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
function RoomsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function ExpensesIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" fill="none" stroke={active ? '#1B3A2D' : '#718096'} strokeWidth="2" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" />
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
