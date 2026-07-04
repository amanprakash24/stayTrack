'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [partnerNames, setPartnerNames] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/partners-list')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPartnerNames(d) })
      .catch(() => {})
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password) { setError('Enter name and password'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      router.push('/bookings')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function switchToAdmin() {
    setIsAdmin(true)
    setName('')
    setPassword('')
    setError('')
  }

  function switchToPartner() {
    setIsAdmin(false)
    setName('')
    setPassword('')
    setError('')
  }

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
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '28px', color: '#1B3A2D', marginBottom: '4px', fontWeight: 800 }}>
          Stay<span style={{ color: '#C9A84C' }}>Track</span>
        </div>
        <div style={{ color: '#718096', fontSize: '13px', marginBottom: '24px' }}>
          Hotel Booking Management
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', background: '#EAF0EC', borderRadius: '10px', padding: '4px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={switchToPartner}
            style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: !isAdmin ? '#1B3A2D' : 'transparent', color: !isAdmin ? '#fff' : '#718096', transition: 'all 0.15s' }}
          >
            Partner Login
          </button>
          <button
            type="button"
            onClick={switchToAdmin}
            style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: isAdmin ? '#C9A84C' : 'transparent', color: isAdmin ? '#fff' : '#718096', transition: 'all 0.15s' }}
          >
            Admin Login
          </button>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>{isAdmin ? 'Admin Username' : 'Select Your Name'}</label>

            {isAdmin ? (
              <input
                style={inputStyle}
                type="text"
                placeholder="Enter admin username"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="username"
                autoFocus
              />
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
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: '44px' }}
                type={showPwd ? 'text' : 'password'}
                placeholder="Enter password"
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
              background: loading ? '#A0AEC0' : isAdmin ? '#C9A84C' : '#1B3A2D',
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

        <div style={{ borderTop: '1px solid #EAF0EC', marginTop: '20px', paddingTop: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#718096', marginBottom: '8px' }}>
            Staff member? View bookings without logging in
          </div>
          <button
            type="button"
            onClick={() => { window.location.href = '/staff-view' }}
            style={{
              width: '100%',
              background: '#F4F7F5',
              color: '#1B3A2D',
              border: '1.5px solid #D1DDD4',
              borderRadius: '10px',
              padding: '11px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Bookings (Staff)
          </button>
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
