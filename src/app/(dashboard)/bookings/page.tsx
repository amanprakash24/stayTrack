'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fmtINR, fmtDateShort, getPlanLabel, totalPaid, PAYMENT_MODES, getPaymentModeLabel } from '@/lib/utils'
import BillModal from '@/components/BillModal'
import TourismBillModal from '@/components/TourismBillModal'
import { showToast } from '@/components/Toast'

interface Payment { id: string; amount: number; mode?: string | null; receivedBy?: string | null; note?: string; recordedBy: { name: string }; createdAt: string }
interface AuditLog { id: string; action: string; user: { name: string }; createdAt: string }
interface Hotel { id: string; name: string; location: string; tourismFee?: number | null; managerName?: string | null; managerPhone?: string | null }
interface Booking {
  id: string; bookingRef: string; guestName: string; phone: string; email?: string; address?: string;
  hotel: Hotel; checkin: string; checkout: string; planType: string; roomType?: string | null;
  guests: number; childGuests: number; childRate: number; rooms: number; ratePerUnit: number; subtotal: number;
  taxPercent: number; taxAmount: number; totalCost: number; advance: number;
  advanceMode?: string | null; advanceReceivedBy?: string | null;
  status: string; notes?: string; bookedBy?: string | null; createdBy: { name: string }; createdAt: string;
  cancelled: boolean; cancelledAt?: string | null; cancelledBy?: string | null; cancellationReason?: string | null;
  refundType?: string | null; refundAmount: number; refundMode?: string | null; refundBy?: string | null;
  payments: Payment[]; auditLogs: AuditLog[];
}

const FILTERS = [
  { key: 'all', label: 'All' }, { key: 'partial', label: 'Partial' },
  { key: 'pending', label: 'Pending' }, { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Booking | null>(null)
  const [payAmt, setPayAmt] = useState('')
  const [payMode, setPayMode] = useState('CASH')
  const [payReceivedBy, setPayReceivedBy] = useState('')
  const [payLoading, setPayLoading] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelForm, setCancelForm] = useState({ reason: '', refundType: 'NONE', refundAmount: '', refundMode: 'CASH', refundBy: '' })
  const [cancelLoading, setCancelLoading] = useState(false)
  const [showBill, setShowBill] = useState(false)
  const [showTourismBill, setShowTourismBill] = useState(false)
  const [locations, setLocations] = useState<string[]>([])
  const [locFilter, setLocFilter] = useState('')
  const [role, setRole] = useState<string | null>(null)
  // Until the role loads, behave like staff so revenue never flashes on screen
  const isStaff = role === null || role === 'STAFF'

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setRole(d.user?.role ?? null)).catch(() => {})
  }, [])

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
    setPayMode('CASH')
    setPayReceivedBy('')
    setShowCancel(false)
    setCancelForm({ reason: '', refundType: 'NONE', refundAmount: '', refundMode: 'CASH', refundBy: '' })
  }

  // The card's Bill button opens the booking detail modal, where
  // Generate Bill / Tourism Bill are available
  function quickBill(b: Booking, e: React.MouseEvent) {
    e.stopPropagation()
    openBooking(b)
  }

  async function addPayment(markFull = false) {
    if (!selected) return
    const amt = markFull ? undefined : Number(payAmt)
    if (!markFull && (!amt || amt <= 0)) { showToast('Enter a valid amount'); return }
    if (!payReceivedBy.trim()) { showToast('Enter who received the payment (staff name)'); return }
    setPayLoading(true)
    const res = await fetch(`/api/bookings/${selected.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt, markFullyPaid: markFull, mode: payMode, receivedBy: payReceivedBy.trim() }),
    })
    const data = await res.json()
    setPayLoading(false)
    if (!res.ok) { showToast(data.error ?? 'Error'); return }
    showToast(markFull ? 'Booking marked as fully paid ✓' : `Payment of ${fmtINR(Number(payAmt))} recorded!`)
    setPayAmt('')
    await openBooking(selected)
    loadBookings()
  }

  async function cancelBooking() {
    if (!selected) return
    if (!cancelForm.reason.trim()) { showToast('Enter cancellation reason'); return }
    if (!cancelForm.refundBy.trim()) { showToast('Enter staff name'); return }
    if (cancelForm.refundType === 'PARTIAL' && !(Number(cancelForm.refundAmount) > 0)) {
      showToast('Enter refund amount'); return
    }
    if (!confirm(`Cancel booking ${selected.bookingRef}? This cannot be undone.`)) return
    setCancelLoading(true)
    const res = await fetch(`/api/bookings/${selected.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: cancelForm.reason.trim(),
        refundType: cancelForm.refundType,
        refundAmount: Number(cancelForm.refundAmount) || 0,
        refundMode: cancelForm.refundMode,
        staffName: cancelForm.refundBy.trim(),
      }),
    })
    const data = await res.json()
    setCancelLoading(false)
    if (!res.ok) { showToast(data.error ?? 'Failed to cancel'); return }
    showToast(`Booking ${selected.bookingRef} cancelled`)
    setShowCancel(false)
    await openBooking(selected)
    loadBookings()
  }

  // Cancellation is allowed until the end of the checkout day
  const checkoutPassed = (checkout: string) => {
    const end = new Date(checkout)
    end.setHours(23, 59, 59, 999)
    return new Date() > end
  }

  const paid = selected ? totalPaid(selected.advance, selected.payments) : 0
  const pending = selected ? Math.max(0, selected.totalCost - paid) : 0
  const pct = selected ? Math.round((paid / selected.totalCost) * 100) : 0

  const statusColor = (s: string) =>
    s === 'CANCELLED' ? { bg: '#EDEDED', color: '#5A5A5A' } :
    s === 'PAID' ? { bg: '#E6F5EC', color: '#1E7E4E' } :
    s === 'PARTIAL' ? { bg: '#FEFCE8', color: '#B7791F' } :
    { bg: '#FDECEA', color: '#C0392B' }

  const statusLabel = (s: string) => s === 'CANCELLED' ? '✕ Cancelled' : s === 'PAID' ? '✓ Paid' : s === 'PARTIAL' ? '½ Partial' : '✗ Pending'
  const bStatus = (b: Booking) => b.cancelled ? 'CANCELLED' : b.status

  // Summary stats (cancelled bookings excluded from money figures)
  const activeBookings = bookings.filter(b => !b.cancelled)
  const totalBookings = activeBookings.length
  const pendingAmt = activeBookings.reduce((s, b) => s + Math.max(0, b.totalCost - totalPaid(b.advance, b.payments)), 0)
  const thisMonth = activeBookings.filter(b => new Date(b.createdAt).getMonth() === new Date().getMonth()).length
  const revenue = activeBookings.reduce((s, b) => s + b.totalCost, 0)

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
            // Revenue is hidden from staff accounts
            ...(isStaff ? [] : [{ label: 'Revenue', value: fmtINR(revenue), style: { color: '#C9A84C' } }]),
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
            placeholder="Search by booking no, name, phone, hotel…"
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
          const pend = b.cancelled ? 0 : Math.max(0, b.totalCost - p)
          const sc = statusColor(bStatus(b))
          return (
            <div key={b.id} onClick={isStaff ? undefined : () => openBooking(b)} style={{ ...bookingCard, cursor: isStaff ? 'default' : 'pointer', opacity: b.cancelled ? 0.65 : 1 }}>
              <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#1B3A2D' }}>{b.guestName} <span style={{ fontSize: '11px', color: '#718096', fontWeight: 500 }}>· {b.bookingRef}</span></div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>🏨 {b.hotel.name} · {b.hotel.location}</div>
                  <div style={{ fontSize: '11px', color: '#4A5568', marginTop: '4px' }}>
                    📅 {fmtDateShort(b.checkin)} → {fmtDateShort(b.checkout)} · {b.guests} guest{b.guests > 1 ? 's' : ''}{b.childGuests ? ` + ${b.childGuests} child${b.childGuests > 1 ? 'ren' : ''}` : ''} · {b.rooms} room{b.rooms > 1 ? 's' : ''}{b.roomType ? ` (${b.roomType === 'DELUXE' ? 'Deluxe AC' : 'Std Non-AC'})` : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>{getPlanLabel(b.planType)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                    {statusLabel(bStatus(b))}
                  </span>
                  <button
                    onClick={e => quickBill(b, e)}
                    style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: '#FDF6E3', color: '#C9A84C', border: '1px solid #C9A84C', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
                  >
                    🧾 Bill
                  </button>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #EAF0EC', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#718096' }}><strong style={{ display: 'block', fontSize: '13px', color: '#1A2E22', fontWeight: 600 }}>{fmtINR(b.totalCost)}</strong>Total</div>
                  <div style={{ fontSize: '11px', color: '#718096' }}><strong style={{ display: 'block', fontSize: '13px', color: '#1E7E4E', fontWeight: 600 }}>{fmtINR(p)}</strong>Paid</div>
                  {pend > 0 && <div style={{ fontSize: '11px', color: '#718096' }}><strong style={{ display: 'block', fontSize: '13px', color: '#C0392B', fontWeight: 600 }}>{fmtINR(pend)}</strong>Due</div>}
                </div>
                <div style={{ fontSize: '11px', color: '#718096' }}>via {(b.bookedBy ?? b.createdBy.name).split(' ')[0]}</div>
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
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #EAF0EC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', color: '#1B3A2D', fontWeight: 800 }}>{selected.guestName}</div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>{selected.hotel.name} · {selected.hotel.location}</div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: statusColor(bStatus(selected)).bg, color: statusColor(bStatus(selected)).color }}>
                  {statusLabel(bStatus(selected))}
                </span>
              </div>
              {/* Action buttons at the top */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => setShowBill(true)} style={btnGold}>🧾 Generate Bill</button>
                <button onClick={() => setShowTourismBill(true)} style={{ ...btnOutline, color: '#C9A84C', borderColor: '#C9A84C' }}>
                  🏞 Tourism Bill
                </button>
                {/* Editing is admin/partner only (server enforces it too) */}
                {!isStaff && !selected.cancelled && (
                  <button onClick={() => router.push(`/add?edit=${selected.id}`)} style={btnOutline}>✏ Edit</button>
                )}
                <button onClick={() => setSelected(null)} style={btnOutline}>Close</button>
              </div>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(92vh - 80px)' }}>
              {/* Guest details */}
              <div style={sectionTitle}>Guest Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px', marginBottom: '20px' }}>
                {[
                  ['Phone', selected.phone], ['Email', selected.email || '—'],
                  ['Check-in', fmtDateShort(selected.checkin)], ['Check-out', fmtDateShort(selected.checkout)],
                  ['Guests', `${selected.guests}${selected.childGuests ? ` + ${selected.childGuests} child${selected.childGuests > 1 ? 'ren' : ''}` : ''}`],
                  ['Rooms', `${selected.rooms}${selected.roomType ? ` · ${selected.roomType === 'DELUXE' ? 'Deluxe AC' : 'Standard Non-AC'}` : ''}`],
                  ['Plan', getPlanLabel(selected.planType)], ['Ref', selected.bookingRef],
                  ['Booked By', selected.bookedBy ?? selected.createdBy.name], ['Account', selected.createdBy.name],
                ].map(([k, v]) => (
                  <div key={String(k)}><span style={{ color: '#718096' }}>{k}</span><br /><strong>{v}</strong></div>
                ))}
              </div>
              {selected.notes && <div style={{ fontSize: '12px', color: '#718096', marginBottom: '16px' }}>📝 {selected.notes}</div>}

              {/* Cancellation info */}
              {selected.cancelled && (
                <div style={{ background: '#FDECEA', border: '1px solid #C0392B', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Booking Cancelled</div>
                  <div style={{ fontSize: '13px', color: '#4A5568', display: 'grid', gap: '4px' }}>
                    {selected.cancelledAt && <div><span style={{ color: '#718096' }}>Date:</span> <strong>{new Date(selected.cancelledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>}
                    {selected.cancelledBy && <div><span style={{ color: '#718096' }}>Cancelled By:</span> <strong>{selected.cancelledBy}</strong></div>}
                    <div><span style={{ color: '#718096' }}>Reason:</span> <strong>{selected.cancellationReason}</strong></div>
                    <div><span style={{ color: '#718096' }}>Refund:</span> <strong>
                      {selected.refundType === 'NONE' ? 'No refund' :
                        `${selected.refundType === 'FULL' ? 'Full' : 'Partial'} — ${fmtINR(selected.refundAmount)} via ${getPaymentModeLabel(selected.refundMode)}${selected.refundBy ? ` by ${selected.refundBy}` : ''}`}
                    </strong></div>
                  </div>
                </div>
              )}

              {/* Payment status */}
              <div style={sectionTitle}>Payment Status</div>
              <div style={{ background: '#EAF0EC', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
                {[
                  ['Total Cost', fmtINR(selected.totalCost), ''],
                  [`Advance Paid${selected.advanceMode ? ` · ${getPaymentModeLabel(selected.advanceMode)}` : ''}${selected.advanceReceivedBy ? ` · by ${selected.advanceReceivedBy}` : ''}`, fmtINR(selected.advance), '#1E7E4E'],
                  ...selected.payments.map((p, i) => [
                    `Payment ${i + 1}${p.mode ? ` · ${getPaymentModeLabel(p.mode)}` : ''}${p.receivedBy ? ` · by ${p.receivedBy}` : ''}${p.note ? ` (${p.note})` : ''}`,
                    fmtINR(p.amount), '#1E7E4E',
                  ]),
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
              {selected.status !== 'PAID' && !selected.cancelled && (
                <>
                  <div style={sectionTitle}>Add Payment</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={payLbl}>Amount (₹)</label>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={payLbl}>Payment Mode *</label>
                      <select value={payMode} onChange={e => setPayMode(e.target.value)} style={{ ...inputS, width: '100%' }}>
                        {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={payLbl}>Received By (Staff) *</label>
                      <input value={payReceivedBy} onChange={e => setPayReceivedBy(e.target.value)} placeholder="Staff name" style={{ ...inputS, width: '100%' }} />
                    </div>
                  </div>
                  <button onClick={() => addPayment(true)} disabled={payLoading} style={btnOutline}>✓ Mark Fully Paid</button>
                </>
              )}

              {/* Cancel booking — not available to staff */}
              {!selected.cancelled && !isStaff && (
                <div style={{ marginTop: '24px' }}>
                  {!showCancel ? (
                    <button
                      onClick={() => {
                        if (checkoutPassed(selected.checkout)) {
                          showToast('Booking cannot be cancelled — checkout date has passed')
                          return
                        }
                        setShowCancel(true)
                      }}
                      style={{
                        ...btnOutline, color: '#C0392B', borderColor: '#C0392B', width: '100%',
                        ...(checkoutPassed(selected.checkout) ? { opacity: 0.45, cursor: 'not-allowed' } : {}),
                      }}
                    >
                      ✕ Cancel Booking
                    </button>
                  ) : (
                    <div style={{ background: '#FDECEA', border: '1px solid #C0392B', borderRadius: '10px', padding: '14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Cancel Booking</div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={payLbl}>Cancellation Reason *</label>
                        <input value={cancelForm.reason} onChange={e => setCancelForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Guest changed plans" style={{ ...inputS, width: '100%', background: '#fff' }} />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={payLbl}>Staff Name (Cancelled By) *</label>
                        <input value={cancelForm.refundBy} onChange={e => setCancelForm(f => ({ ...f, refundBy: e.target.value }))} placeholder="Staff name" style={{ ...inputS, width: '100%', background: '#fff' }} />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label style={payLbl}>Refund Type *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[['NONE', 'No Refund'], ['PARTIAL', 'Partial'], ['FULL', `Full (${fmtINR(paid)})`]].map(([val, label]) => (
                            <button key={val} onClick={() => setCancelForm(f => ({ ...f, refundType: val }))} style={{
                              flex: 1, padding: '8px 4px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                              border: `1.5px solid ${cancelForm.refundType === val ? '#C0392B' : '#D1DDD4'}`,
                              background: cancelForm.refundType === val ? '#C0392B' : '#fff',
                              color: cancelForm.refundType === val ? '#fff' : '#4A5568',
                            }}>{label}</button>
                          ))}
                        </div>
                      </div>
                      {cancelForm.refundType !== 'NONE' && (
                        <>
                          {cancelForm.refundType === 'PARTIAL' && (
                            <div style={{ marginBottom: '10px' }}>
                              <label style={payLbl}>Refund Amount (₹) *</label>
                              <input type="number" value={cancelForm.refundAmount} onChange={e => setCancelForm(f => ({ ...f, refundAmount: e.target.value }))} placeholder={`Max ${fmtINR(paid)}`} style={{ ...inputS, width: '100%', background: '#fff' }} />
                            </div>
                          )}
                          <div style={{ marginBottom: '10px' }}>
                            <label style={payLbl}>Refund Mode *</label>
                            <select value={cancelForm.refundMode} onChange={e => setCancelForm(f => ({ ...f, refundMode: e.target.value }))} style={{ ...inputS, width: '100%', background: '#fff' }}>
                              {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                          </div>
                          <div style={{ fontSize: '11px', color: '#718096', marginBottom: '10px' }}>Refund amount will automatically be added to hotel expenses.</div>
                        </>
                      )}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={cancelBooking} disabled={cancelLoading} style={{ ...btnGreen, background: '#C0392B', flex: 2 }}>
                          {cancelLoading ? 'Cancelling…' : 'Confirm Cancellation'}
                        </button>
                        <button onClick={() => setShowCancel(false)} style={{ ...btnOutline, flex: 1 }}>Back</button>
                      </div>
                    </div>
                  )}
                </div>
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

            </div>
          </div>
        </div>
      )}

      {/* Tourism Bill Modal */}
      {showTourismBill && selected && (
        <TourismBillModal booking={selected} onClose={() => setShowTourismBill(false)} />
      )}

      {/* Bill Modal */}
      {showBill && selected && (
        <BillModal
          booking={selected}
          paid={paid}
          pending={pending}
          onClose={() => setShowBill(false)}
          onEditBooking={!isStaff && !selected.cancelled ? () => router.push(`/add?edit=${selected.id}`) : undefined}
        />
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
const payLbl: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }
const btnGreen: React.CSSProperties = { background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnGold: React.CSSProperties = { background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const filterBtn = (active: boolean): React.CSSProperties => ({
  whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
  border: `1.5px solid ${active ? '#1B3A2D' : '#D1DDD4'}`,
  background: active ? '#1B3A2D' : '#fff', color: active ? '#fff' : '#4A5568',
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})
