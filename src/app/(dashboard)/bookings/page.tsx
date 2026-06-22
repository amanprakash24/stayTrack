'use client'
import { useEffect, useState, useCallback } from 'react'
import { fmtINR, fmtDateShort, getPlanLabel, totalPaid } from '@/lib/utils'
import BillModal from '@/components/BillModal'

interface Payment { id: string; amount: number; note?: string; recordedBy: { name: string }; createdAt: string }
interface AuditLog { id: string; action: string; user: { name: string }; createdAt: string }
interface Hotel { id: string; name: string; location: string }
interface Booking {
  id: string; bookingRef: string; guestName: string; phone: string; email?: string; address?: string;
  hotel: Hotel; checkin: string; checkout: string; planType: string;
  guests: number; rooms: number; ratePerUnit: number; subtotal: number;
  taxPercent: number; taxAmount: number; totalCost: number; advance: number;
  status: string; notes?: string; createdBy: { name: string }; createdAt: string;
  payments: Payment[]; auditLogs: AuditLog[];
}

const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'partial', label: 'Partial' },
  { key: 'pending', label: 'Pending' }, { key: 'paid', label: 'Paid' },
]

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Booking | null>(null)
  const [payAmt, setPayAmt] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [showBill, setShowBill] = useState(false)
  const [locations, setLocations] = useState<string[]>([])
  const [locFilter, setLocFilter] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter !== 'all' && !['darjeeling','gangtok','himachal'].includes(filter)) params.set('filter', filter)
    if (search) params.set('search', search)
    if (locFilter) params.set('location', locFilter)
    const res = await fetch(`/api/bookings?${params}`)
    const data = await res.json()
    setBookings(Array.isArray(data) ? data : [])
    // Extract unique locations
    const locs = [...new Set((Array.isArray(data) ? data : []).map((b: Booking) => b.hotel.location))] as string[]
    if (locs.length) setLocations(locs)
    setLoading(false)
  }, [filter, search, locFilter])

  useEffect(() => { loadBookings() }, [loadBookings])

  async function openBooking(b: Booking) {
    const res = await fetch(`/api/bookings/${b.id}`)
    const data = await res.json()
    setSelected(data)
    setPayAmt('')
  }

  async function addPayment(markFull = false) {
    if (!selected) return
    const amt = markFull ? undefined : Number(payAmt)
    if (!markFull && (!amt || amt <= 0)) { showToast('Enter a valid amount'); return }
    setPayLoading(true)
    const res = await fetch(`/api/bookings/${selected.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, markFullyPaid: markFull }),
    })
    const data = await res.json()
    setPayLoading(false)
    if (!res.ok) { showToast(data.error ?? 'Error'); return }
    showToast(markFull ? 'Booking marked as fully paid ✓' : `Payment of ${fmtINR(Number(payAmt))} recorded!`)
    setPayAmt('')
    await openBooking(selected)
    loadBookings()
  }

  const paid = selected ? totalPaid(selected.advance, selected.payments) : 0
  const pending = selected ? Math.max(0, selected.totalCost - paid) : 0
  const pct = selected ? Math.round((paid / selected.totalCost) * 100) : 0

  const statusColor = (s: string) =>
    s === 'PAID' ? { bg: '#E6F5EC', color: '#1E7E4E' } :
    s === 'PARTIAL' ? { bg: '#FEFCE8', color: '#B7791F' } :
    { bg: '#FDECEA', color: '#C0392B' }

  const statusLabel = (s: string) => s === 'PAID' ? '✓ Paid' : s === 'PARTIAL' ? '½ Partial' : '✗ Pending'

  // Summary stats
  const totalBookings = bookings.length
  const pendingAmt = bookings.reduce((s, b) => s + Math.max(0, b.totalCost - totalPaid(b.advance, b.payments)), 0)
  const thisMonth = bookings.filter(b => new Date(b.createdAt).getMonth() === new Date().getMonth()).length
  const revenue = bookings.reduce((s, b) => s + b.totalCost, 0)

  return (
    <>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>Bookings</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>All properties · Live data</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Total Bookings', value: totalBookings, style: {} },
            { label: 'Pending ₹', value: fmtINR(pendingAmt), style: { color: '#C0392B' } },
            { label: 'This Month', value: thisMonth, style: {} },
            { label: 'Revenue', value: fmtINR(revenue), style: { color: '#C9A84C' } },
          ].map(s => (
            <div key={s.label} style={statCard}>
              <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', color: '#1B3A2D', marginTop: '2px', ...s.style }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1.5px solid #D1DDD4', borderRadius: '10px', padding: '0 12px', marginBottom: '12px' }}>
          <svg width="16" height="16" fill="none" stroke="#718096" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search by name, phone, hotel…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '14px', padding: '10px 0', flex: 1, fontFamily: 'Inter, sans-serif', background: 'transparent' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setLocFilter('') }} style={filterBtn(filter === f.key && !locFilter)}>{f.label}</button>
          ))}
          {locations.map(loc => (
            <button key={loc} onClick={() => { setLocFilter(loc); setFilter('all') }} style={filterBtn(locFilter === loc)}>{loc}</button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#718096', padding: '40px', fontSize: '14px' }}>Loading…</div>
        ) : bookings.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#718096', padding: '40px', fontSize: '14px' }}>No bookings found</div>
        ) : bookings.map(b => {
          const p = totalPaid(b.advance, b.payments)
          const pend = Math.max(0, b.totalCost - p)
          const sc = statusColor(b.status)
          return (
            <div key={b.id} onClick={() => openBooking(b)} style={bookingCard}>
              <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#1B3A2D' }}>{b.guestName}</div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>🏨 {b.hotel.name} · {b.hotel.location}</div>
                  <div style={{ fontSize: '11px', color: '#4A5568', marginTop: '4px' }}>
                    📅 {fmtDateShort(b.checkin)} → {fmtDateShort(b.checkout)} · {b.guests} guest{b.guests > 1 ? 's' : ''} · {b.rooms} room{b.rooms > 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>{getPlanLabel(b.planType)}</div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                  {statusLabel(b.status)}
                </span>
              </div>
              <div style={{ borderTop: '1px solid #EAF0EC', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#718096' }}><strong style={{ display: 'block', fontSize: '13px', color: '#1A2E22', fontWeight: 600 }}>{fmtINR(b.totalCost)}</strong>Total</div>
                  <div style={{ fontSize: '11px', color: '#718096' }}><strong style={{ display: 'block', fontSize: '13px', color: '#1E7E4E', fontWeight: 600 }}>{fmtINR(p)}</strong>Paid</div>
                  {pend > 0 && <div style={{ fontSize: '11px', color: '#718096' }}><strong style={{ display: 'block', fontSize: '13px', color: '#C0392B', fontWeight: 600 }}>{fmtINR(pend)}</strong>Due</div>}
                </div>
                <div style={{ fontSize: '11px', color: '#718096' }}>via {b.createdBy.name.split(' ')[0]}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Booking Detail Modal */}
      {selected && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={modal} className="slide-up">
            <div style={{ width: 40, height: 4, background: '#D1DDD4', borderRadius: 2, margin: '12px auto 0' }} />
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #EAF0EC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', color: '#1B3A2D', fontWeight: 800 }}>{selected.guestName}</div>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: statusColor(selected.status).bg, color: statusColor(selected.status).color }}>
                  {statusLabel(selected.status)}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>{selected.hotel.name} · {selected.hotel.location}</div>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(92vh - 80px)' }}>
              {/* Guest details */}
              <div style={sectionTitle}>Guest Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', marginBottom: '20px' }}>
                {[
                  ['Phone', selected.phone], ['Email', selected.email || '—'],
                  ['Check-in', fmtDateShort(selected.checkin)], ['Check-out', fmtDateShort(selected.checkout)],
                  ['Guests', selected.guests], ['Rooms', selected.rooms],
                  ['Plan', getPlanLabel(selected.planType)], ['Ref', selected.bookingRef],
                ].map(([k, v]) => (
                  <div key={String(k)}><span style={{ color: '#718096' }}>{k}</span><br /><strong>{v}</strong></div>
                ))}
              </div>
              {selected.notes && <div style={{ fontSize: '12px', color: '#718096', marginBottom: '16px' }}>📝 {selected.notes}</div>}

              {/* Payment status */}
              <div style={sectionTitle}>Payment Status</div>
              <div style={{ background: '#EAF0EC', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
                {[
                  ['Total Cost', fmtINR(selected.totalCost), ''],
                  ['Advance Paid', fmtINR(selected.advance), '#1E7E4E'],
                  ...selected.payments.map((p, i) => [`Payment ${i + 1}${p.note ? ` (${p.note})` : ''}`, fmtINR(p.amount), '#1E7E4E']),
                ].map(([k, v, c]) => (
                  <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                    <span>{k}</span><span style={{ color: c || 'inherit', fontWeight: c ? 600 : 400 }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, borderTop: '1px solid #D1DDD4', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Total Paid</span><strong>{fmtINR(paid)}</strong>
                </div>
                {selected.taxAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#718096', paddingTop: '4px' }}>
                    <span>Tax ({selected.taxPercent}%)</span><span>{fmtINR(selected.taxAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: pending > 0 ? '#C0392B' : '#1E7E4E', paddingTop: '4px' }}>
                  <span>Still Pending</span><span>{pending > 0 ? fmtINR(pending) : 'None 🎉'}</span>
                </div>
                <div style={{ background: '#D1DDD4', borderRadius: '4px', height: '6px', margin: '10px 0 4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#1B3A2D,#C9A84C)', borderRadius: '4px', width: `${pct}%`, transition: 'width 0.4s' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#718096' }}>{pct}% collected</div>
              </div>

              {/* Add payment */}
              {selected.status !== 'PAID' && (
                <>
                  <div style={sectionTitle}>Add Payment</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Amount (₹)</label>
                      <input
                        type="number"
                        value={payAmt}
                        onChange={e => setPayAmt(e.target.value)}
                        placeholder="e.g. 3000"
                        style={{ ...inputS, width: '100%' }}
                      />
                    </div>
                    <button onClick={() => addPayment(false)} disabled={payLoading} style={btnGreen}>
                      {payLoading ? '…' : 'Record'}
                    </button>
                  </div>
                  <button onClick={() => addPayment(true)} disabled={payLoading} style={btnOutline}>✓ Mark Fully Paid</button>
                </>
              )}

              {/* Edit history */}
              <div style={{ ...sectionTitle, marginTop: '20px' }}>Edit History</div>
              {selected.auditLogs.map(log => (
                <div key={log.id} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid #EAF0EC' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1B3A2D', marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', color: '#4A5568' }}><strong style={{ color: '#1B3A2D' }}>{log.user.name}</strong> · {log.action}</div>
                    <div style={{ fontSize: '11px', color: '#718096' }}>🕐 {new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px' }}>
                <button onClick={() => setShowBill(true)} style={btnGold}>🧾 Generate Bill</button>
                <button onClick={() => setSelected(null)} style={btnOutline}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {showBill && selected && (
        <BillModal booking={selected} paid={paid} pending={pending} onClose={() => setShowBill(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: '#1B3A2D', color: '#fff', padding: '10px 20px', borderRadius: '24px', fontSize: '13px', fontWeight: 500, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(27,58,45,0.18)' }}>
          {toast}
        </div>
      )}
    </>
  )
}

const statCard: React.CSSProperties = { background: '#fff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)' }
const bookingCard: React.CSSProperties = { background: '#fff', borderRadius: '10px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)', marginBottom: '10px', cursor: 'pointer' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }
const modal: React.CSSProperties = { background: '#fff', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
const sectionTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#718096', marginBottom: '10px' }
const inputS: React.CSSProperties = { padding: '10px 12px', border: '1.5px solid #D1DDD4', borderRadius: '8px', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none' }
const btnGreen: React.CSSProperties = { background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnGold: React.CSSProperties = { background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const filterBtn = (active: boolean): React.CSSProperties => ({
  whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
  border: `1.5px solid ${active ? '#1B3A2D' : '#D1DDD4'}`,
  background: active ? '#1B3A2D' : '#fff', color: active ? '#fff' : '#4A5568',
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})
