'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { calcSubtotal, nightsBetween, PAYMENT_MODES } from '@/lib/utils'
import { showToast } from '@/components/Toast'

interface Hotel { id: string; name: string; location: string; totalRooms: number; standardRooms?: number | null; deluxeRooms?: number | null }
interface Availability { available: number; totalRooms: number; isAvailable: boolean }

const PLANS = [
  { value: 'AP', label: 'AP — All Meals (per head/day)' },
  { value: 'MAP', label: 'MAP — Breakfast + 1 Meal (per head/day)' },
  { value: 'CP', label: 'CP — Breakfast Only (per head/day)' },
  { value: 'EP', label: 'EP — Room Only (per room/day)' },
  { value: 'LODGING', label: 'Lodging Only (per room/day)' },
]

const isPerHead = (plan: string) => ['AP', 'MAP', 'CP'].includes(plan)

export default function AddBookingPage() {
  // useSearchParams needs a Suspense boundary for prerendering
  return <Suspense fallback={null}><AddBookingForm /></Suspense>
}

function AddBookingForm() {
  const router = useRouter()
  // ?edit=<bookingId> switches the form to edit mode (admin/partner only)
  const editId = useSearchParams().get('edit')
  const [editRef, setEditRef] = useState('')
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    guestName: '', phone: '', email: '', address: '',
    hotelId: '', checkin: '', checkout: '',
    planType: 'AP', guests: '2', childGuests: '', childRate: '', rooms: '1',
    ratePerUnit: '', taxPercent: '0', advance: '', notes: '',
    advanceMode: 'CASH', advanceReceivedBy: '', bookedBy: '',
  })
  const [pickRoomType, setPickRoomType] = useState(false)
  const [roomType, setRoomType] = useState('STANDARD')

  // Edit mode: prefill the form from the existing booking
  useEffect(() => {
    if (!editId) return
    fetch(`/api/bookings/${editId}`).then(r => r.json()).then(b => {
      if (!b?.id) { showToast('Booking not found'); return }
      if (b.cancelled) { showToast('Cancelled bookings cannot be edited'); router.push('/bookings'); return }
      setEditRef(b.bookingRef)
      setForm(f => ({
        ...f,
        guestName: b.guestName, phone: b.phone, email: b.email ?? '', address: b.address ?? '',
        hotelId: b.hotelId, checkin: String(b.checkin).slice(0, 10), checkout: String(b.checkout).slice(0, 10),
        planType: b.planType, guests: String(b.guests),
        childGuests: b.childGuests ? String(b.childGuests) : '',
        childRate: b.childRate ? String(b.childRate) : '',
        rooms: String(b.rooms), ratePerUnit: String(b.ratePerUnit), taxPercent: String(b.taxPercent),
        notes: b.notes ?? '', bookedBy: b.bookedBy ?? f.bookedBy,
      }))
      if (b.roomType) { setPickRoomType(true); setRoomType(b.roomType) }
    }).catch(() => showToast('Failed to load booking'))
  }, [editId, router])

  // Prefill "Booked By" with the logged-in user's name (still editable)
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.name) setForm(f => f.bookedBy ? f : { ...f, bookedBy: d.user.name })
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/hotels').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setHotels(d)
        // Staff see only their hotel — pre-select it
        if (d.length === 1) setForm(f => ({ ...f, hotelId: d[0].id }))
      }
    })
  }, [])

  const checkAvailability = useCallback(async () => {
    if (!form.hotelId || !form.checkin || !form.checkout) return
    const params = new URLSearchParams({ checkin: form.checkin, checkout: form.checkout })
    if (editId) params.set('exclude', editId) // don't count this booking's own rooms against itself
    const res = await fetch(`/api/hotels/${form.hotelId}/availability?${params}`)
    if (res.ok) setAvailability(await res.json())
  }, [form.hotelId, form.checkin, form.checkout, editId])

  useEffect(() => { checkAvailability() }, [checkAvailability])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Checkin can't be in the past; checkout must be at least the day after checkin
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const minCheckout = form.checkin
    ? (() => { const d = new Date(form.checkin); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()
    : undefined
  // Editing keeps old bookings reachable, so no past-date restriction there
  const checkinPast = Boolean(!editId && form.checkin && form.checkin < todayStr)
  const dateInvalid = Boolean(form.checkin && form.checkout && form.checkout <= form.checkin)

  // Auto-calculations
  const nights = form.checkin && form.checkout && !dateInvalid ? nightsBetween(form.checkin, form.checkout) : 0
  const rate = Number(form.ratePerUnit) || 0
  const guests = Number(form.guests) || 1
  const children = Math.max(0, Number(form.childGuests) || 0)
  const childRate = children > 0 ? Math.max(0, Number(form.childRate) || 0) : 0
  const childAmount = children * childRate * nights
  const rooms = Number(form.rooms) || 1
  const tax = Number(form.taxPercent) || 0
  const subtotal = (nights && rate ? calcSubtotal(form.planType, guests, rooms, rate, nights) : 0) + childAmount
  const taxAmount = Math.round(subtotal * tax / 100)
  const totalCost = subtotal + taxAmount
  const advance = Number(form.advance) || 0
  const balanceDue = Math.max(0, totalCost - advance)

  function fmtINR(n: number) { return n ? '₹' + n.toLocaleString('en-IN') : '—' }

  async function save() {
    if (!form.guestName || !form.phone || !form.hotelId || !form.checkin || !form.checkout || !form.planType || !form.ratePerUnit) {
      showToast('Fill all required fields'); return
    }
    if (!form.bookedBy.trim()) {
      showToast('Enter who is taking this booking (Booked By)'); return
    }
    if (checkinPast) {
      showToast('Check-in date cannot be in the past'); return
    }
    if (dateInvalid) {
      showToast('Check-out date must be after check-in date'); return
    }
    if (!editId) {
      if (form.advance.trim() === '' || Number(form.advance) < 0) {
        showToast('Enter amount received / advance (enter 0 if nothing received)'); return
      }
      if (advance > 0 && !form.advanceReceivedBy.trim()) {
        showToast('Enter who received the advance (staff name)'); return
      }
    }
    if (Number(form.rooms) > (availability?.available ?? 0)) {
      showToast(`Only ${availability?.available} room(s) available for these dates`); return
    }
    setLoading(true)
    const payload = {
      ...form, guests, childGuests: children, childRate, rooms,
      ratePerUnit: rate, taxPercent: tax, advance, roomType: pickRoomType ? roomType : null,
    }
    const res = await fetch(editId ? `/api/bookings/${editId}` : '/api/bookings', {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { showToast(data.error ?? 'Failed to save'); return }
    showToast(editId ? `Booking ${data.bookingRef} updated ✓` : `Booking ${data.bookingRef} saved!`)
    setTimeout(() => router.push('/bookings'), 1000)
  }

  return (
    <>
      <div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>{editId ? 'Edit Booking' : 'New Booking'}</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>{editId ? `Editing ${editRef || '…'} — payments are managed from the booking page` : 'Fill guest details below'}</div>
        </div>

        <div style={card}>
          <div style={secTitle}>Guest Information</div>
          <div style={group}>
            <label style={lbl}>Guest Name *</label>
            <input style={inp} placeholder="Full name" value={form.guestName} onChange={e => set('guestName', e.target.value)} />
          </div>
          <div style={row2}>
            <div style={group}>
              <label style={lbl}>Phone *</label>
              <input style={inp} type="tel" placeholder="10-digit number" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div style={group}>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" placeholder="optional" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div style={group}>
            <label style={lbl}>Home City / Address</label>
            <input style={inp} placeholder="Guest home city" value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div style={group}>
            <label style={lbl}>Booked By (Staff / Partner / Admin) *</label>
            <input style={inp} placeholder="Who is taking this booking" value={form.bookedBy} onChange={e => set('bookedBy', e.target.value)} />
          </div>

          <div style={divider} />
          <div style={secTitle}>Property & Dates</div>

          <div style={group}>
            <label style={lbl}>Property *</label>
            <select style={{ ...inp, ...(editId ? { background: '#F4F6F5', cursor: 'not-allowed' } : {}) }} disabled={!!editId} value={form.hotelId} onChange={e => { set('hotelId', e.target.value); setAvailability(null) }}>
              <option value="">Select hotel</option>
              {hotels.map(h => <option key={h.id} value={h.id}>{h.name} · {h.location}</option>)}
            </select>
          </div>

          <div style={row2}>
            <div style={group}>
              <label style={lbl}>Check-in *</label>
              <input style={{ ...inp, width: '85%' }} type="date" min={editId ? undefined : todayStr} value={form.checkin} onChange={e => set('checkin', e.target.value)} />
            </div>
            <div style={group}>
              <label style={lbl}>Check-out *</label>
              <input style={{ ...inp, width: '85%' }} type="date" min={minCheckout} value={form.checkout} onChange={e => set('checkout', e.target.value)} />
            </div>
          </div>

          {(dateInvalid || checkinPast) && (
            <div style={{ background: '#FDECEA', color: '#C0392B', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>
              {checkinPast ? '✗ Check-in date cannot be in the past' : '✗ Check-out date must be after check-in date'}
            </div>
          )}

          {nights > 0 && (
            <div style={{ fontSize: '12px', color: '#1B3A2D', fontWeight: 600, marginBottom: '12px' }}>
              📅 {nights} night{nights > 1 ? 's' : ''}
            </div>
          )}

          {/* Availability indicator */}
          {availability && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', background: availability.isAvailable ? '#E6F5EC' : '#FDECEA', border: `1px solid ${availability.isAvailable ? '#1E7E4E' : '#C0392B'}`, fontSize: '13px', color: availability.isAvailable ? '#1E7E4E' : '#C0392B', fontWeight: 600 }}>
              {availability.isAvailable
                ? `✓ ${availability.available} of ${availability.totalRooms} rooms available`
                : `✗ No rooms available for these dates`}
            </div>
          )}

          <div style={row2}>
            <div style={group}>
              <label style={lbl}>No. of Guests</label>
              <input style={inp} type="number" min="1" placeholder="e.g. 2" value={form.guests} onChange={e => set('guests', e.target.value)} />
            </div>
            <div style={group}>
              <label style={lbl}>No. of Rooms</label>
              <input style={inp} type="number" min="1" placeholder="e.g. 1" value={form.rooms} onChange={e => set('rooms', e.target.value)} />
            </div>
          </div>

          <div style={row2}>
            <div style={group}>
              <label style={lbl}>Children (optional)</label>
              <input style={inp} type="number" min="0" placeholder="e.g. 1" value={form.childGuests} onChange={e => set('childGuests', e.target.value)} />
            </div>
            <div style={group}>
              <label style={lbl}>Child Rate / Day (₹)</label>
              <input style={inp} type="number" min="0" placeholder="e.g. 600" value={form.childRate} onChange={e => set('childRate', e.target.value)} disabled={children === 0} />
            </div>
          </div>

          {/* Optional room type */}
          <div style={{ ...group, marginTop: '-2px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4A5568', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={pickRoomType} onChange={e => setPickRoomType(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#1B3A2D', cursor: 'pointer' }} />
              Select room type (optional)
            </label>
            {pickRoomType && (() => {
              const h = hotels.find(x => x.id === form.hotelId)
              return (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  {[
                    ['STANDARD', `Standard Non-AC${h?.standardRooms ? ` (${h.standardRooms})` : ''}`],
                    ['DELUXE', `Deluxe AC${h?.deluxeRooms ? ` (${h.deluxeRooms})` : ''}`],
                  ].map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setRoomType(val)} style={{
                      flex: 1, padding: '9px 6px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      border: `1.5px solid ${roomType === val ? '#1B3A2D' : '#D1DDD4'}`,
                      background: roomType === val ? '#1B3A2D' : '#fff',
                      color: roomType === val ? '#fff' : '#4A5568',
                    }}>{label}</button>
                  ))}
                </div>
              )
            })()}
          </div>

          <div style={divider} />
          <div style={secTitle}>Plan & Pricing</div>

          <div style={group}>
            <label style={lbl}>Meal Plan *</label>
            <select style={inp} value={form.planType} onChange={e => set('planType', e.target.value)}>
              {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
              {isPerHead(form.planType) ? '→ Charged per person per day' : '→ Charged per room per day'}
            </div>
          </div>

          <div style={row2}>
            <div style={group}>
              <label style={lbl}>{isPerHead(form.planType) ? 'Rate / Head / Day (₹) *' : 'Rate / Room / Day (₹) *'}</label>
              <input style={inp} type="number" placeholder="e.g. 1200" value={form.ratePerUnit} onChange={e => set('ratePerUnit', e.target.value)} />
            </div>
            <div style={group}>
              <label style={lbl}>Tax % (GST)</label>
              <input style={inp} type="number" min="0" max="100" placeholder="e.g. 12" value={form.taxPercent} onChange={e => set('taxPercent', e.target.value)} />
            </div>
          </div>

          {/* Auto-calculated total */}
          {totalCost > 0 && (
            <div style={{ background: '#EAF0EC', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#718096', marginBottom: '10px' }}>Auto-Calculated Total</div>
              {[
                isPerHead(form.planType)
                  ? [`${guests} person${guests>1?'s':''} × ${fmtINR(rate)}/head × ${nights} night${nights>1?'s':''}`, fmtINR(subtotal - childAmount)]
                  : [`${rooms} room${rooms>1?'s':''} × ${fmtINR(rate)}/room × ${nights} night${nights>1?'s':''}`, fmtINR(subtotal - childAmount)],
                ...(childAmount > 0 ? [[`${children} child${children>1?'ren':''} × ${fmtINR(childRate)}/day × ${nights} night${nights>1?'s':''}`, fmtINR(childAmount)]] : []),
                ...(tax > 0 ? [[`GST/Tax (${tax}%)`, fmtINR(taxAmount)]] : []),
              ].map(([k, v]) => (
                <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0', color: '#4A5568' }}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#1B3A2D', borderTop: '1px solid #D1DDD4', paddingTop: '8px', marginTop: '4px' }}>
                <span>Total Cost</span><span>{fmtINR(totalCost)}</span>
              </div>
            </div>
          )}

          {/* Payments aren't edited here — the booking page has its own payment tools */}
          {!editId && (
            <>
              <div style={divider} />
              <div style={secTitle}>Payment</div>

              <div style={group}>
                <label style={lbl}>Amount Received / Advance (₹) *</label>
                <input style={inp} type="number" min="0" placeholder="e.g. 5000 (enter 0 if none)" value={form.advance} onChange={e => set('advance', e.target.value)} />
              </div>

              {advance > 0 && (
                <div style={row2}>
                  <div style={group}>
                    <label style={lbl}>Payment Mode *</label>
                    <select style={inp} value={form.advanceMode} onChange={e => set('advanceMode', e.target.value)}>
                      {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div style={group}>
                    <label style={lbl}>Received By (Staff) *</label>
                    <input style={inp} placeholder="Staff name" value={form.advanceReceivedBy} onChange={e => set('advanceReceivedBy', e.target.value)} />
                  </div>
                </div>
              )}

              {advance > 0 && totalCost > 0 && (
                <div style={{ fontSize: '13px', color: balanceDue > 0 ? '#C0392B' : '#1E7E4E', fontWeight: 600, marginBottom: '14px' }}>
                  {balanceDue > 0 ? `Balance due: ${fmtINR(balanceDue)}` : '✓ Fully paid upfront'}
                </div>
              )}
            </>
          )}

          <div style={group}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} placeholder="Special requests, inclusions…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={save} disabled={loading} style={{ background: loading ? '#2A5441' : '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {loading ? 'Saving…' : editId ? 'Update Booking' : 'Save Booking'}
            </button>
            {editId ? (
              <button onClick={() => router.push('/bookings')} style={{ background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Cancel
              </button>
            ) : (
              <button onClick={() => { setForm(f => ({ guestName:'',phone:'',email:'',address:'',hotelId:'',checkin:'',checkout:'',planType:'AP',guests:'2',childGuests:'',childRate:'',rooms:'1',ratePerUnit:'',taxPercent:'0',advance:'',notes:'',advanceMode:'CASH',advanceReceivedBy:'',bookedBy:f.bookedBy })); showToast('Form cleared') }} style={{ background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)' }
const secTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#718096', marginBottom: '14px' }
const group: React.CSSProperties = { marginBottom: '14px' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#4A5568', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #D1DDD4', borderRadius: '8px', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff', color: '#1A2E22' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
const divider: React.CSSProperties = { height: '1px', background: '#EAF0EC', margin: '16px 0' }
