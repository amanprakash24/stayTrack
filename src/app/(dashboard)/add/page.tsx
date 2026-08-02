'use client'
import { useState, useEffect, Suspense } from 'react'
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

function emptyLeg() {
  return {
    uid: Math.random().toString(36).slice(2),
    id: undefined as string | undefined,
    hotelId: '', checkin: '', checkout: '',
    planType: 'AP', guests: '2', childGuests: '', childRate: '', rooms: '1',
    ratePerUnit: '', taxPercent: '0', pickRoomType: false, roomType: 'STANDARD',
  }
}
type LegForm = ReturnType<typeof emptyLeg>

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
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    guestName: '', phone: '', email: '', address: '',
    advance: '', notes: '', advanceMode: 'CASH', advanceReceivedBy: '', bookedBy: '',
  })
  const [legs, setLegs] = useState<LegForm[]>([emptyLeg()])
  const [legAvailability, setLegAvailability] = useState<Record<string, Availability | null>>({})

  const isStaff = role === 'STAFF'

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
        notes: b.notes ?? '', bookedBy: b.bookedBy ?? f.bookedBy,
      }))
      const sortedLegs = [...(b.legs ?? [])].sort((a: { order: number }, c: { order: number }) => a.order - c.order)
      if (sortedLegs.length) {
        setLegs(sortedLegs.map((l: {
          id: string; hotelId: string; checkin: string; checkout: string; planType: string
          guests: number; childGuests?: number; childRate?: number; rooms: number
          ratePerUnit: number; taxPercent: number; roomType?: string | null
        }) => ({
          uid: l.id, id: l.id, hotelId: l.hotelId,
          checkin: String(l.checkin).slice(0, 10), checkout: String(l.checkout).slice(0, 10),
          planType: l.planType, guests: String(l.guests),
          childGuests: l.childGuests ? String(l.childGuests) : '',
          childRate: l.childRate ? String(l.childRate) : '',
          rooms: String(l.rooms), ratePerUnit: String(l.ratePerUnit), taxPercent: String(l.taxPercent),
          pickRoomType: !!l.roomType, roomType: l.roomType ?? 'STANDARD',
        })))
      }
    }).catch(() => showToast('Failed to load booking'))
  }, [editId, router])

  // Prefill "Booked By" with the logged-in user's name (still editable); also learn the role
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.user?.name) setForm(f => f.bookedBy ? f : { ...f, bookedBy: d.user.name })
      if (d.user?.role) setRole(d.user.role)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/hotels').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setHotels(d)
        // Staff see only their hotel — pre-select it
        if (d.length === 1) setLegs(ls => ls.map(l => (l.hotelId ? l : { ...l, hotelId: d[0].id })))
      }
    })
  }, [])

  // Per-leg availability check
  useEffect(() => {
    legs.forEach(l => {
      if (!l.hotelId || !l.checkin || !l.checkout) return
      const params = new URLSearchParams({ checkin: l.checkin, checkout: l.checkout })
      if (l.id) params.set('exclude', l.id)
      fetch(`/api/hotels/${l.hotelId}/availability?${params}`)
        .then(r => (r.ok ? r.json() : null))
        .then(data => { if (data) setLegAvailability(a => ({ ...a, [l.uid]: data })) })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(legs.map(l => ({ uid: l.uid, hotelId: l.hotelId, checkin: l.checkin, checkout: l.checkout, id: l.id })))])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }
  function addLeg() { setLegs(ls => [...ls, emptyLeg()]) }
  function removeLeg(uid: string) {
    setLegs(ls => (ls.length > 1 ? ls.filter(l => l.uid !== uid) : ls))
    setLegAvailability(a => { const next = { ...a }; delete next[uid]; return next })
  }
  function setLeg(uid: string, field: string, value: string | boolean) {
    setLegs(ls => ls.map(l => (l.uid === uid ? { ...l, [field]: value } : l)))
  }

  // Checkin can't be in the past (for new stays); checkout must be at least the day after checkin
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  function minCheckoutFor(checkin: string) {
    const d = new Date(checkin); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10)
  }

  function legCalc(l: LegForm) {
    const dateInvalid = Boolean(l.checkin && l.checkout && l.checkout <= l.checkin)
    const nights = l.checkin && l.checkout && !dateInvalid ? nightsBetween(l.checkin, l.checkout) : 0
    const rate = Number(l.ratePerUnit) || 0
    const guests = Number(l.guests) || 1
    const children = Math.max(0, Number(l.childGuests) || 0)
    const childRate = children > 0 ? Math.max(0, Number(l.childRate) || 0) : 0
    const childAmount = children * childRate * nights
    const rooms = Number(l.rooms) || 1
    const tax = Number(l.taxPercent) || 0
    const subtotal = (nights && rate ? calcSubtotal(l.planType, guests, rooms, rate, nights) : 0) + childAmount
    const taxAmount = Math.round(subtotal * tax / 100)
    const totalCost = subtotal + taxAmount
    const checkinPast = Boolean(!l.id && l.checkin && l.checkin < todayStr)
    return { dateInvalid, nights, rate, guests, children, childRate, childAmount, rooms, tax, subtotal, taxAmount, totalCost, checkinPast }
  }
  const legCalcs = legs.map(legCalc)
  const grandTotal = legCalcs.reduce((s, c) => s + c.totalCost, 0)

  const advance = Number(form.advance) || 0
  const balanceDue = Math.max(0, grandTotal - advance)

  function fmtINR(n: number) { return n ? '₹' + n.toLocaleString('en-IN') : '—' }

  async function save() {
    if (!form.guestName || !form.phone) { showToast('Fill all required fields'); return }
    if (!form.bookedBy.trim()) { showToast('Enter who is taking this booking (Booked By)'); return }

    for (let i = 0; i < legs.length; i++) {
      const l = legs[i]
      const c = legCalcs[i]
      if (!l.hotelId || !l.checkin || !l.checkout || !l.planType || !l.ratePerUnit) {
        showToast(`Fill all required fields for Stay ${i + 1}`); return
      }
      if (c.checkinPast) { showToast(`Stay ${i + 1}: check-in date cannot be in the past`); return }
      if (c.dateInvalid) { showToast(`Stay ${i + 1}: check-out date must be after check-in date`); return }
      const avail = legAvailability[l.uid]
      if (avail && Number(l.rooms) > avail.available) {
        showToast(`Stay ${i + 1}: only ${avail.available} room(s) available for these dates`); return
      }
    }
    if (!editId) {
      if (form.advance.trim() === '' || Number(form.advance) < 0) {
        showToast('Enter amount received / advance (enter 0 if nothing received)'); return
      }
      if (advance > 0 && !form.advanceReceivedBy.trim()) {
        showToast('Enter who received the advance (staff name)'); return
      }
    }

    setLoading(true)
    const payload = {
      guestName: form.guestName, phone: form.phone, email: form.email, address: form.address,
      bookedBy: form.bookedBy, notes: form.notes,
      advance, advanceMode: form.advanceMode, advanceReceivedBy: form.advanceReceivedBy,
      legs: legs.map(l => ({
        id: l.id, hotelId: l.hotelId, checkin: l.checkin, checkout: l.checkout,
        planType: l.planType, roomType: l.pickRoomType ? l.roomType : null,
        guests: Number(l.guests) || 1, childGuests: Math.max(0, Number(l.childGuests) || 0),
        childRate: Number(l.childRate) || 0, rooms: Number(l.rooms) || 1,
        ratePerUnit: Number(l.ratePerUnit), taxPercent: Number(l.taxPercent) || 0,
      })),
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
        </div>

        {legs.map((l, i) => {
          const c = legCalcs[i]
          const h = hotels.find(x => x.id === l.hotelId)
          return (
            <div key={l.uid} style={{ ...card, marginTop: '14px' }}>
              <div style={{ ...secTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <span>Stay {i + 1}{legs.length > 1 ? ` of ${legs.length}` : ''}</span>
                {legs.length > 1 && !isStaff && (
                  <button type="button" onClick={() => removeLeg(l.uid)} style={removeBtn}>✕ Remove</button>
                )}
              </div>

              <div style={group}>
                <label style={lbl}>Property *</label>
                <select
                  style={{ ...inp, ...(l.id ? { background: '#F4F6F5', cursor: 'not-allowed' } : {}) }}
                  disabled={!!l.id}
                  value={l.hotelId}
                  onChange={e => setLeg(l.uid, 'hotelId', e.target.value)}
                >
                  <option value="">Select hotel</option>
                  {hotels.map(hh => <option key={hh.id} value={hh.id}>{hh.name} · {hh.location}</option>)}
                </select>
              </div>

              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Check-in *</label>
                  <input style={{ ...inp, width: '85%' }} type="date" min={l.id ? undefined : todayStr} value={l.checkin} onChange={e => setLeg(l.uid, 'checkin', e.target.value)} />
                </div>
                <div style={group}>
                  <label style={lbl}>Check-out *</label>
                  <input style={{ ...inp, width: '85%' }} type="date" min={l.checkin ? minCheckoutFor(l.checkin) : undefined} value={l.checkout} onChange={e => setLeg(l.uid, 'checkout', e.target.value)} />
                </div>
              </div>

              {(c.dateInvalid || c.checkinPast) && (
                <div style={{ background: '#FDECEA', color: '#C0392B', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '12px', fontWeight: 600 }}>
                  {c.checkinPast ? '✗ Check-in date cannot be in the past' : '✗ Check-out date must be after check-in date'}
                </div>
              )}

              {c.nights > 0 && (
                <div style={{ fontSize: '12px', color: '#1B3A2D', fontWeight: 600, marginBottom: '12px' }}>
                  📅 {c.nights} night{c.nights > 1 ? 's' : ''}
                </div>
              )}

              {legAvailability[l.uid] && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', background: legAvailability[l.uid]!.isAvailable ? '#E6F5EC' : '#FDECEA', border: `1px solid ${legAvailability[l.uid]!.isAvailable ? '#1E7E4E' : '#C0392B'}`, fontSize: '13px', color: legAvailability[l.uid]!.isAvailable ? '#1E7E4E' : '#C0392B', fontWeight: 600 }}>
                  {legAvailability[l.uid]!.isAvailable
                    ? `✓ ${legAvailability[l.uid]!.available} of ${legAvailability[l.uid]!.totalRooms} rooms available`
                    : `✗ No rooms available for these dates`}
                </div>
              )}

              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>No. of Guests</label>
                  <input style={inp} type="number" min="1" placeholder="e.g. 2" value={l.guests} onChange={e => setLeg(l.uid, 'guests', e.target.value)} />
                </div>
                <div style={group}>
                  <label style={lbl}>No. of Rooms</label>
                  <input style={inp} type="number" min="1" placeholder="e.g. 1" value={l.rooms} onChange={e => setLeg(l.uid, 'rooms', e.target.value)} />
                </div>
              </div>

              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Children (optional)</label>
                  <input style={inp} type="number" min="0" placeholder="e.g. 1" value={l.childGuests} onChange={e => setLeg(l.uid, 'childGuests', e.target.value)} />
                </div>
                <div style={group}>
                  <label style={lbl}>Child Rate / Day (₹)</label>
                  <input style={inp} type="number" min="0" placeholder="e.g. 600" value={l.childRate} onChange={e => setLeg(l.uid, 'childRate', e.target.value)} disabled={c.children === 0} />
                </div>
              </div>

              {/* Optional room type */}
              <div style={{ ...group, marginTop: '-2px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#4A5568', fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" checked={l.pickRoomType} onChange={e => setLeg(l.uid, 'pickRoomType', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#1B3A2D', cursor: 'pointer' }} />
                  Select room type (optional)
                </label>
                {l.pickRoomType && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    {[
                      ['STANDARD', `Standard Non-AC${h?.standardRooms ? ` (${h.standardRooms})` : ''}`],
                      ['DELUXE', `Deluxe AC${h?.deluxeRooms ? ` (${h.deluxeRooms})` : ''}`],
                    ].map(([val, label]) => (
                      <button key={val} type="button" onClick={() => setLeg(l.uid, 'roomType', val)} style={{
                        flex: 1, padding: '9px 6px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        border: `1.5px solid ${l.roomType === val ? '#1B3A2D' : '#D1DDD4'}`,
                        background: l.roomType === val ? '#1B3A2D' : '#fff',
                        color: l.roomType === val ? '#fff' : '#4A5568',
                      }}>{label}</button>
                    ))}
                  </div>
                )}
              </div>

              <div style={divider} />
              <div style={secTitle}>Plan & Pricing</div>

              <div style={group}>
                <label style={lbl}>Meal Plan *</label>
                <select style={inp} value={l.planType} onChange={e => setLeg(l.uid, 'planType', e.target.value)}>
                  {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
                  {isPerHead(l.planType) ? '→ Charged per person per day' : '→ Charged per room per day'}
                </div>
              </div>

              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>{isPerHead(l.planType) ? 'Rate / Head / Day (₹) *' : 'Rate / Room / Day (₹) *'}</label>
                  <input style={inp} type="number" placeholder="e.g. 1200" value={l.ratePerUnit} onChange={e => setLeg(l.uid, 'ratePerUnit', e.target.value)} />
                </div>
                <div style={group}>
                  <label style={lbl}>Tax % (GST)</label>
                  <input style={inp} type="number" min="0" max="100" placeholder="e.g. 12" value={l.taxPercent} onChange={e => setLeg(l.uid, 'taxPercent', e.target.value)} />
                </div>
              </div>

              {c.totalCost > 0 && (
                <div style={{ background: '#EAF0EC', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#718096', marginBottom: '10px' }}>Stay {i + 1} Total</div>
                  {[
                    isPerHead(l.planType)
                      ? [`${c.guests} person${c.guests > 1 ? 's' : ''} × ${fmtINR(c.rate)}/head × ${c.nights} night${c.nights > 1 ? 's' : ''}`, fmtINR(c.subtotal - c.childAmount)]
                      : [`${c.rooms} room${c.rooms > 1 ? 's' : ''} × ${fmtINR(c.rate)}/room × ${c.nights} night${c.nights > 1 ? 's' : ''}`, fmtINR(c.subtotal - c.childAmount)],
                    ...(c.childAmount > 0 ? [[`${c.children} child${c.children > 1 ? 'ren' : ''} × ${fmtINR(c.childRate)}/day × ${c.nights} night${c.nights > 1 ? 's' : ''}`, fmtINR(c.childAmount)]] : []),
                    ...(c.tax > 0 ? [[`GST/Tax (${c.tax}%)`, fmtINR(c.taxAmount)]] : []),
                  ].map(([k, v]) => (
                    <div key={String(k)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0', color: '#4A5568' }}>
                      <span>{k}</span><span>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#1B3A2D', borderTop: '1px solid #D1DDD4', paddingTop: '8px', marginTop: '4px' }}>
                    <span>Stay Total</span><span>{fmtINR(c.totalCost)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!isStaff && (
          <button type="button" onClick={addLeg} style={{ ...addLegBtn, marginTop: '14px' }}>
            + Add Another Stay
          </button>
        )}

        {legs.length > 1 && grandTotal > 0 && (
          <div style={{ ...card, marginTop: '14px', background: '#1B3A2D' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#fff' }}>
              <span>Grand Total ({legs.length} stays)</span><span>{fmtINR(grandTotal)}</span>
            </div>
          </div>
        )}

        <div style={{ ...card, marginTop: '14px' }}>
          {!editId && (
            <>
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

              {advance > 0 && grandTotal > 0 && (
                <div style={{ fontSize: '13px', color: balanceDue > 0 ? '#C0392B' : '#1E7E4E', fontWeight: 600, marginBottom: '14px' }}>
                  {balanceDue > 0 ? `Balance due: ${fmtINR(balanceDue)}` : '✓ Fully paid upfront'}
                </div>
              )}
              <div style={divider} />
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
              <button onClick={() => {
                setForm(f => ({ guestName: '', phone: '', email: '', address: '', advance: '', notes: '', advanceMode: 'CASH', advanceReceivedBy: '', bookedBy: f.bookedBy }))
                setLegs([emptyLeg()])
                setLegAvailability({})
                showToast('Form cleared')
              }} style={{ background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
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
const removeBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#C0392B', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textTransform: 'none', letterSpacing: 0 }
const addLegBtn: React.CSSProperties = { width: '100%', background: '#fff', color: '#1B3A2D', border: '1.5px dashed #1B3A2D', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
