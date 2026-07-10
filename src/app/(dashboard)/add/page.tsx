'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { calcSubtotal, nightsBetween, PAYMENT_MODES } from '@/lib/utils'
import { showToast } from '@/components/Toast'

interface Hotel { id: string; name: string; location: string; totalRooms: number }
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
  const router = useRouter()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    guestName: '', phone: '', email: '', address: '',
    hotelId: '', checkin: '', checkout: '',
    planType: 'AP', guests: '2', rooms: '1',
    ratePerUnit: '', taxPercent: '0', advance: '', notes: '',
    advanceMode: 'CASH', advanceReceivedBy: '',
  })

  useEffect(() => {
    fetch('/api/hotels').then(r => r.json()).then(d => { if (Array.isArray(d)) setHotels(d) })
  }, [])

  const checkAvailability = useCallback(async () => {
    if (!form.hotelId || !form.checkin || !form.checkout) return
    const params = new URLSearchParams({ checkin: form.checkin, checkout: form.checkout })
    const res = await fetch(`/api/hotels/${form.hotelId}/availability?${params}`)
    if (res.ok) setAvailability(await res.json())
  }, [form.hotelId, form.checkin, form.checkout])

  useEffect(() => { checkAvailability() }, [checkAvailability])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Auto-calculations
  const nights = form.checkin && form.checkout ? nightsBetween(form.checkin, form.checkout) : 0
  const rate = Number(form.ratePerUnit) || 0
  const guests = Number(form.guests) || 1
  const rooms = Number(form.rooms) || 1
  const tax = Number(form.taxPercent) || 0
  const subtotal = nights && rate ? calcSubtotal(form.planType, guests, rooms, rate, nights) : 0
  const taxAmount = Math.round(subtotal * tax / 100)
  const totalCost = subtotal + taxAmount
  const advance = Number(form.advance) || 0
  const balanceDue = Math.max(0, totalCost - advance)

  function fmtINR(n: number) { return n ? '₹' + n.toLocaleString('en-IN') : '—' }

  async function save() {
    if (!form.guestName || !form.phone || !form.hotelId || !form.checkin || !form.checkout || !form.planType || !form.ratePerUnit) {
      showToast('Fill all required fields'); return
    }
    if (Number(form.rooms) > (availability?.available ?? 0)) {
      showToast(`Only ${availability?.available} room(s) available for these dates`); return
    }
    setLoading(true)
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, guests, rooms, ratePerUnit: rate, taxPercent: tax, advance }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { showToast(data.error ?? 'Failed to save'); return }
    showToast(`Booking ${data.bookingRef} saved!`)
    setTimeout(() => router.push('/bookings'), 1000)
  }

  return (
    <>
      <div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>New Booking</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>Fill guest details below</div>
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

          <div style={divider} />
          <div style={secTitle}>Property & Dates</div>

          <div style={group}>
            <label style={lbl}>Property *</label>
            <select style={inp} value={form.hotelId} onChange={e => { set('hotelId', e.target.value); setAvailability(null) }}>
              <option value="">Select hotel</option>
              {hotels.map(h => <option key={h.id} value={h.id}>{h.name} · {h.location}</option>)}
            </select>
          </div>

          <div style={row2}>
            <div style={group}>
              <label style={lbl}>Check-in *</label>
              <input style={{ ...inp, width: '85%' }} type="date" value={form.checkin} onChange={e => set('checkin', e.target.value)} />
            </div>
            <div style={group}>
              <label style={lbl}>Check-out *</label>
              <input style={{ ...inp, width: '85%' }} type="date" value={form.checkout} onChange={e => set('checkout', e.target.value)} />
            </div>
          </div>

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
                  ? [`${guests} person${guests>1?'s':''} × ${fmtINR(rate)}/head × ${nights} night${nights>1?'s':''}`, fmtINR(subtotal)]
                  : [`${rooms} room${rooms>1?'s':''} × ${fmtINR(rate)}/room × ${nights} night${nights>1?'s':''}`, fmtINR(subtotal)],
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

          <div style={divider} />
          <div style={secTitle}>Payment</div>

          <div style={group}>
            <label style={lbl}>Amount Received / Advance (₹)</label>
            <input style={inp} type="number" placeholder="e.g. 5000" value={form.advance} onChange={e => set('advance', e.target.value)} />
          </div>

          {advance > 0 && (
            <div style={row2}>
              <div style={group}>
                <label style={lbl}>Payment Mode</label>
                <select style={inp} value={form.advanceMode} onChange={e => set('advanceMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div style={group}>
                <label style={lbl}>Received By (Staff)</label>
                <input style={inp} placeholder="Staff name" value={form.advanceReceivedBy} onChange={e => set('advanceReceivedBy', e.target.value)} />
              </div>
            </div>
          )}

          {advance > 0 && totalCost > 0 && (
            <div style={{ fontSize: '13px', color: balanceDue > 0 ? '#C0392B' : '#1E7E4E', fontWeight: 600, marginBottom: '14px' }}>
              {balanceDue > 0 ? `Balance due: ${fmtINR(balanceDue)}` : '✓ Fully paid upfront'}
            </div>
          )}

          <div style={group}>
            <label style={lbl}>Notes</label>
            <textarea style={{ ...inp, minHeight: '70px', resize: 'vertical' }} placeholder="Special requests, inclusions…" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button onClick={save} disabled={loading} style={{ background: loading ? '#2A5441' : '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {loading ? 'Saving…' : 'Save Booking'}
            </button>
            <button onClick={() => { setForm({ guestName:'',phone:'',email:'',address:'',hotelId:'',checkin:'',checkout:'',planType:'AP',guests:'2',rooms:'1',ratePerUnit:'',taxPercent:'0',advance:'',notes:'',advanceMode:'CASH',advanceReceivedBy:'' }); showToast('Form cleared') }} style={{ background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Clear
            </button>
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
