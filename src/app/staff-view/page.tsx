'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate, fmtINR, getPlanLabel, totalPaid } from '@/lib/utils'

interface Payment { amount: number }
interface Hotel { id: string; name: string; location: string }
interface Booking {
  id: string; bookingRef: string; guestName: string; phone: string
  email?: string; address?: string; hotel: Hotel
  checkin: string; checkout: string; planType: string
  guests: number; rooms: number; ratePerUnit: number
  subtotal: number; taxPercent: number; taxAmount: number
  totalCost: number; advance: number; status: string
  notes?: string; createdBy: { name: string }; createdAt: string
  payments: Payment[]
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All Status' },
  { key: 'paid', label: 'Paid' },
  { key: 'partial', label: 'Partial' },
  { key: 'pending', label: 'Pending' },
]

function nightsBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000))
}

export default function StaffViewPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [hotelFilter, setHotelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/bookings')
      .then(r => r.json())
      .then(d => { setBookings(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const hotels = useMemo(() => {
    const map = new Map<string, string>()
    bookings.forEach(b => map.set(b.hotel.id, b.hotel.name))
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [bookings])

  const filtered = useMemo(() => {
    return bookings.filter(b => {
      if (hotelFilter !== 'all' && b.hotel.id !== hotelFilter) return false
      if (statusFilter !== 'all' && b.status.toLowerCase() !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !b.guestName.toLowerCase().includes(q) &&
          !b.phone.includes(q) &&
          !b.hotel.name.toLowerCase().includes(q) &&
          !b.bookingRef.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [bookings, hotelFilter, statusFilter, search])

  async function exportExcel() {
    const { utils, writeFile } = await import('xlsx')
    const rows = filtered.map((b, i) => {
      const paid = totalPaid(b.advance, b.payments)
      const due = Math.max(0, b.totalCost - paid)
      const nights = nightsBetween(b.checkin, b.checkout)
      return {
        '#': i + 1,
        'Booking Ref': b.bookingRef,
        'Guest Name': b.guestName,
        'Phone': b.phone,
        'Email': b.email || '',
        'Hotel': b.hotel.name,
        'Location': b.hotel.location,
        'Check-in': fmtDate(b.checkin),
        'Check-out': fmtDate(b.checkout),
        'Nights': nights,
        'Guests': b.guests,
        'Rooms': b.rooms,
        'Plan': getPlanLabel(b.planType),
        'Rate/Unit (₹)': b.ratePerUnit,
        'Subtotal (₹)': b.subtotal,
        'Tax %': b.taxPercent,
        'Tax Amt (₹)': b.taxAmount,
        'Total (₹)': b.totalCost,
        'Paid (₹)': paid,
        'Due (₹)': due,
        'Status': b.status,
        'Notes': b.notes || '',
        'Booked By': b.createdBy.name,
        'Booked On': fmtDate(b.createdAt),
      }
    })

    const ws = utils.json_to_sheet(rows)
    const colWidths = [4, 12, 20, 14, 22, 20, 14, 12, 12, 7, 7, 6, 18, 13, 13, 7, 12, 12, 12, 10, 10, 20, 18, 14]
    ws['!cols'] = colWidths.map(w => ({ wch: w }))

    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Bookings')

    const hotelName = hotelFilter === 'all' ? 'All Hotels' : (hotels.find(h => h[0] === hotelFilter)?.[1] ?? 'Hotels')
    writeFile(wb, `StayTrack_Bookings_${hotelName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const statusBadge = (s: string) => {
    const cfg = s === 'PAID'
      ? { bg: '#E6F5EC', color: '#1E7E4E' }
      : s === 'PARTIAL'
      ? { bg: '#FEFCE8', color: '#B7791F' }
      : { bg: '#FDECEA', color: '#C0392B' }
    return (
      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
        {s === 'PAID' ? 'Paid' : s === 'PARTIAL' ? 'Partial' : 'Pending'}
      </span>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7F5', fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#1B3A2D', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800, color: '#fff' }}>
            Stay<span style={{ color: '#C9A84C' }}>Track</span>
          </span>
          <span style={{ color: '#52b788', fontSize: '12px', fontWeight: 600, background: 'rgba(82,183,136,0.15)', padding: '2px 10px', borderRadius: '20px' }}>
            Staff View
          </span>
        </div>
        <button
          onClick={() => router.push('/login')}
          style={{ background: 'transparent', border: '1.5px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Back to Login
        </button>
      </div>

      <div style={{ padding: '20px 16px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Page title */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', color: '#1B3A2D', fontWeight: 800 }}>Booking Records</div>
          <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>Read-only view · {filtered.length} booking{filtered.length !== 1 ? 's' : ''} shown</div>
        </div>

        {/* Controls */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #D1DDD4', boxShadow: '0 2px 8px rgba(27,58,45,0.06)', marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1.5px solid #D1DDD4', borderRadius: '8px', padding: '0 10px', flex: '1', minWidth: '180px' }}>
            <svg width="14" height="14" fill="none" stroke="#718096" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="Search by name, phone, hotel, ref…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13px', padding: '8px 0', flex: 1, fontFamily: 'Inter, sans-serif', background: 'transparent' }}
            />
          </div>

          {/* Hotel filter */}
          <select
            value={hotelFilter}
            onChange={e => setHotelFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All Hotels</option>
            {hotels.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={selectStyle}
          >
            {STATUS_FILTERS.map(f => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>

          {/* Export button */}
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            style={{
              background: filtered.length === 0 ? '#A0AEC0' : '#1B3A2D',
              color: '#fff', border: 'none', borderRadius: '8px',
              padding: '9px 18px', fontSize: '13px', fontWeight: 600,
              cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Excel
          </button>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #D1DDD4', boxShadow: '0 2px 8px rgba(27,58,45,0.06)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#718096', fontSize: '14px' }}>Loading bookings…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#718096', fontSize: '14px' }}>No bookings found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#1B3A2D' }}>
                    {[
                      '#', 'Ref', 'Guest Name', 'Phone', 'Hotel', 'Location',
                      'Check-in', 'Check-out', 'Nights', 'Guests', 'Rooms',
                      'Plan', 'Total', 'Paid', 'Due', 'Status', 'Booked By', 'Booked On',
                    ].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b, i) => {
                    const paid = totalPaid(b.advance, b.payments)
                    const due = Math.max(0, b.totalCost - paid)
                    const nights = nightsBetween(b.checkin, b.checkout)
                    const even = i % 2 === 0
                    return (
                      <tr key={b.id} style={{ background: even ? '#fff' : '#F9FBFA' }}>
                        <td style={tdStyle}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: '#1B3A2D', whiteSpace: 'nowrap' }}>{b.bookingRef}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 500 }}>{b.guestName}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#4A5568' }}>{b.phone}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 500 }}>{b.hotel.name}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#4A5568' }}>{b.hotel.location}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(b.checkin)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(b.checkout)}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{nights}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{b.guests}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{b.rooms}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#4A5568', fontSize: '12px' }}>{getPlanLabel(b.planType)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600, color: '#1B3A2D' }}>{fmtINR(b.totalCost)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600, color: '#1E7E4E' }}>{fmtINR(paid)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600, color: due > 0 ? '#C0392B' : '#718096' }}>
                          {due > 0 ? fmtINR(due) : '—'}
                        </td>
                        <td style={tdStyle}>{statusBadge(b.status)}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#4A5568' }}>{b.createdBy.name}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#718096', fontSize: '12px' }}>{fmtDate(b.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer summary */}
          {!loading && filtered.length > 0 && (() => {
            const totalRevenue = filtered.reduce((s, b) => s + b.totalCost, 0)
            const totalCollected = filtered.reduce((s, b) => s + totalPaid(b.advance, b.payments), 0)
            const totalDue = Math.max(0, totalRevenue - totalCollected)
            return (
              <div style={{ borderTop: '1px solid #D1DDD4', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '24px', background: '#F4F7F5' }}>
                {[
                  ['Bookings', filtered.length.toString(), '#1B3A2D'],
                  ['Total Revenue', fmtINR(totalRevenue), '#1B3A2D'],
                  ['Collected', fmtINR(totalCollected), '#1E7E4E'],
                  ['Pending', fmtINR(totalDue), totalDue > 0 ? '#C0392B' : '#718096'],
                ].map(([label, value, color]) => (
                  <div key={label as string}>
                    <div style={{ fontSize: '10px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: color as string, fontFamily: 'Syne, sans-serif' }}>{value}</div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: '#fff',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.1)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #EAF0EC',
  fontSize: '13px',
  color: '#2D3748',
  verticalAlign: 'middle',
}

const selectStyle: React.CSSProperties = {
  border: '1.5px solid #D1DDD4',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  background: '#fff',
  color: '#2D3748',
  cursor: 'pointer',
}
