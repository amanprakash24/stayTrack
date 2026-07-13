'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { showToast } from '@/components/Toast'
import { BrandName } from '@/components/AppNameProvider'

type Mode = 'partner' | 'staff' | 'admin'

interface StaffHotel { id: string; name: string; location: string }

export default function LoginPage() {
  const router = useRouter()
  const [partnerNames, setPartnerNames] = useState<string[]>([])
  const [staffHotels, setStaffHotels] = useState<StaffHotel[]>([])
  const [mode, setMode] = useState<Mode>('partner')
  const [name, setName] = useState('')
  const [staffHotelId, setStaffHotelId] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/partners-list')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPartnerNames(d) })
      .catch(() => {})
    fetch('/api/auth/staff-hotels')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setStaffHotels(d) })
      .catch(() => {})
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'staff') {
      if (!staffHotelId || !password) { setError('Select your hotel and enter password'); return }
    } else if (!name.trim() || !password) {
      setError('Enter name and password'); return
    }
    setLoading(true)
    setError('')
    try {
      const body = mode === 'staff'
        ? { staffHotelId, password }
        : { name: name.trim(), password }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      showToast(`Welcome, ${data.user?.name ?? 'back'}! ✓`)
      router.push('/bookings')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode(m: Mode) {
    setMode(m)
    setName('')
    setStaffHotelId('')
    setPassword('')
    setError('')
  }

  const accent = mode === 'admin' ? '#C9A84C' : '#1B3A2D'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1B3A2D 0%, #2d6a4f 60%, #52b788 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '18px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(27,58,45,0.18)',
      }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', color: '#1B3A2D', marginBottom: '24px', fontWeight: 800 }}>
          <BrandName />
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#EAF0EC', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
          {([['partner', 'Partner'], ['staff', 'Staff'], ['admin', 'Admin']] as [Mode, string][]).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              style={{
                flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                background: mode === m ? (m === 'admin' ? '#C9A84C' : '#1B3A2D') : 'transparent',
                color: mode === m ? '#fff' : '#718096', transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              {mode === 'admin' ? 'Admin Username' : mode === 'staff' ? 'Select Your Hotel' : 'Select Your Name'}
            </label>

            {mode === 'admin' ? (
              <input
                style={inputStyle}
                type="text"
                placeholder="Enter admin username"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            ) : mode === 'staff' ? (
              <select
                style={{ ...inputStyle, color: staffHotelId ? '#1B3A2D' : '#A0AEC0' }}
                value={staffHotelId}
                onChange={e => setStaffHotelId(e.target.value)}
              >
                <option value="">— Select hotel —</option>
                {staffHotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name} · {h.location}</option>
                ))}
              </select>
            ) : (
              <select
                style={{ ...inputStyle, color: name ? '#1B3A2D' : '#A0AEC0' }}
                value={name}
                onChange={e => setName(e.target.value)}
              >
                <option value="">— Select your name —</option>
                {partnerNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
            {mode === 'staff' && staffHotels.length === 0 && (
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '6px' }}>
                No staff accounts yet — ask admin to create one for your hotel
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: '44px' }}
                type={showPwd ? 'text' : 'password'}
                placeholder={mode === 'staff' ? 'Hotel staff password' : 'Enter password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0, lineHeight: 1 }}
              >
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FDECEA', color: '#C0392B', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#A0AEC0' : accent,
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              padding: '13px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ fontSize: '11px', color: '#718096', textAlign: 'center', marginTop: '20px' }}>
          Contact admin if you forgot your password
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#4A5568',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1.5px solid #D1DDD4',
  borderRadius: '10px',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
}
