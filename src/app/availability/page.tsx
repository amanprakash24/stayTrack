'use client'
import { useEffect, useState } from 'react'
import { showToast } from '@/components/Toast'

interface Hotel { id: string; name: string; location: string; totalRooms: number }
interface AvailResult {
  hotel: Hotel
  totalRooms: number
  bookedRooms: number
  available: number
  isAvailable: boolean
  loading: boolean
  error?: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function AvailabilityPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [hotelId, setHotelId] = useState('all')
  const [checkin, setCheckin] = useState(today())
  const [checkout, setCheckout] = useState(tomorrow())
  const [results, setResults] = useState<AvailResult[]>([])
  const [checked, setChecked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [dateError, setDateError] = useState('')

  useEffect(() => {
    fetch('/api/hotels')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setHotels(d) })
      .catch(() => {})
  }, [])

  async function checkAvailability() {
    if (!checkin || !checkout) { setDateError('Select both dates'); return }
    if (checkin >= checkout) { setDateError('Check-out must be after check-in'); return }
    setDateError('')
    setChecking(true)
    setChecked(false)

    const targets = hotelId === 'all' ? hotels : hotels.filter(h => h.id === hotelId)
    const pending: AvailResult[] = targets.map(h => ({
      hotel: h, totalRooms: h.totalRooms, bookedRooms: 0,
      available: 0, isAvailable: false, loading: true,
    }))
    setResults(pending)
    setChecked(true)

    const updated = await Promise.all(
      targets.map(async (h) => {
        try {
          const res = await fetch(`/api/hotels/${h.id}/availability?checkin=${checkin}&checkout=${checkout}`)
          const data = await res.json()
          return { hotel: h, ...data, loading: false } as AvailResult
        } catch {
          return { hotel: h, totalRooms: h.totalRooms, bookedRooms: 0, available: 0, isAvailable: false, loading: false, error: 'Failed' } as AvailResult
        }
      })
    )
    setResults(updated)
    setChecking(false)
    const openCount = updated.filter(r => r.isAvailable).length
    showToast(openCount > 0 ? `${openCount} hotel${openCount === 1 ? '' : 's'} available for these dates ✓` : 'No rooms available for these dates')
  }

  const nights = checkin && checkout && checkin < checkout
    ? Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
    : 0

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F5', fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#1B3A2D', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, color: '#fff' }}>
            Stay<span style={{ color: '#C9A84C' }}>Track</span>
          </span>
          <span style={{ color: '#C9A84C', fontSize: '12px', fontWeight: 600, background: 'rgba(201,168,76,0.15)', padding: '2px 10px', borderRadius: '20px' }}>
            Room Availability
          </span>
        </div>
        <button
          onClick={() => { window.location.href = '/login' }}
          style={{ background: 'transparent', border: '1.5px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Back to Login
        </button>
      </div>

      <div style={{ padding: '24px 16px', maxWidth: '720px', margin: '0 auto' }}>
        {/* Search card */}
        <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', color: '#1B3A2D', fontWeight: 800, marginBottom: '4px' }}>
            Check Room Availability
          </div>
          <div style={{ fontSize: '12px', color: '#718096', marginBottom: '20px' }}>
            Select dates and hotel to see available rooms
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Check-in</label>
              <input
                type="date"
                value={checkin}
                min={today()}
                onChange={e => setCheckin(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Check-out</label>
              <input
                type="date"
                value={checkout}
                min={checkin || today()}
                onChange={e => setCheckout(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {nights > 0 && (
            <div style={{ fontSize: '12px', color: '#718096', marginBottom: '12px', textAlign: 'right' }}>
              {nights} night{nights !== 1 ? 's' : ''}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Hotel</label>
            <select
              value={hotelId}
              onChange={e => setHotelId(e.target.value)}
              style={inputStyle}
            >
              <option value="all">All Hotels</option>
              {hotels.map(h => (
                <option key={h.id} value={h.id}>{h.name} — {h.location}</option>
              ))}
            </select>
          </div>

          {dateError && (
            <div style={{ background: '#FDECEA', color: '#C0392B', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '12px' }}>
              {dateError}
            </div>
          )}

          <button
            onClick={checkAvailability}
            disabled={checking || hotels.length === 0}
            style={{
              width: '100%',
              background: checking || hotels.length === 0 ? '#A0AEC0' : '#1B3A2D',
              color: '#fff', border: 'none', borderRadius: '10px',
              padding: '13px', fontSize: '14px', fontWeight: 600,
              cursor: checking || hotels.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {checking ? (
              <>Checking…</>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Check Availability
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {checked && results.length > 0 && (
          <>
            <div style={{ fontSize: '12px', color: '#718096', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Results for {new Date(checkin + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → {new Date(checkout + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>

            {results.map(r => {
              const pct = r.loading ? 0 : Math.round((r.available / r.hotel.totalRooms) * 100)
              const barColor = pct === 0 ? '#C0392B' : pct <= 30 ? '#B7791F' : '#1E7E4E'
              return (
                <div key={r.hotel.id} style={{ background: '#fff', borderRadius: '12px', border: `1.5px solid ${r.isAvailable ? '#D1DDD4' : '#FDECEA'}`, boxShadow: '0 2px 8px rgba(27,58,45,0.06)', marginBottom: '10px', padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#1B3A2D' }}>{r.hotel.name}</div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>{r.hotel.location}</div>
                    </div>
                    {r.loading ? (
                      <span style={{ fontSize: '12px', color: '#718096' }}>Checking…</span>
                    ) : (
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                        background: r.available === 0 ? '#FDECEA' : r.available <= 2 ? '#FEFCE8' : '#E6F5EC',
                        color: r.available === 0 ? '#C0392B' : r.available <= 2 ? '#B7791F' : '#1E7E4E',
                      }}>
                        {r.available === 0 ? 'Fully Booked' : r.available <= 2 ? 'Almost Full' : 'Available'}
                      </span>
                    )}
                  </div>

                  {!r.loading && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
                        {[
                          { label: 'Total Rooms', value: r.hotel.totalRooms, color: '#1B3A2D' },
                          { label: 'Booked', value: r.bookedRooms, color: '#C0392B' },
                          { label: 'Available', value: r.available, color: barColor },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: 'center', background: '#F4F7F5', borderRadius: '8px', padding: '10px' }}>
                            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: '10px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ background: '#EAF0EC', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '4px',
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px', textAlign: 'right' }}>
                        {pct}% rooms free
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </>
        )}

        {checked && results.length === 0 && (
          <div style={{ textAlign: 'center', color: '#718096', padding: '40px', fontSize: '14px' }}>
            No hotels found
          </div>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#4A5568',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #D1DDD4',
  borderRadius: '10px',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  background: '#fff',
  boxSizing: 'border-box',
  color: '#1B3A2D',
}
