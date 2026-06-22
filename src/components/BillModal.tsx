'use client'
import { useState } from 'react'
import { fmtINR, fmtDate, nightsBetween, getPlanLabel } from '@/lib/utils'

interface Payment { amount: number }
interface Booking {
  id: string; bookingRef: string; guestName: string; phone: string; email?: string;
  hotel: { name: string; location: string };
  checkin: string; checkout: string;
  planType: string; guests: number; rooms: number; ratePerUnit: number;
  subtotal: number; taxPercent: number; taxAmount: number; totalCost: number;
  advance: number; payments: Payment[];
}

// PDF-safe currency: jsPDF Helvetica has no Rs symbol (U+20B9)
function rs(n: number) {
  return 'Rs. ' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function BillModal({ booking: b, paid, pending, onClose }: {
  booking: Booking; paid: number; pending: number; onClose: () => void
}) {
  const [step, setStep] = useState<'gst' | 'bill'>('gst')
  const [gstNo, setGstNo] = useState('')

  const nights = nightsBetween(b.checkin, b.checkout)
  const invNo = 'INV-' + b.bookingRef

  function downloadBill() {
    const el = document.getElementById('bill-content')
    if (!el) return
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      doc.html(el, {
        callback: (d) => { d.save(`${invNo}-${b.guestName}.pdf`) },
        x: 20, y: 20, width: 555, windowWidth: 650,
      })
    })
  }

  async function shareBill() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Invoice ${invNo}`, text: `Bill for ${b.guestName} — ${fmtINR(b.totalCost)}` })
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(`Invoice ${invNo} for ${b.guestName}: Total ${fmtINR(b.totalCost)}, Balance due ${fmtINR(pending)}`)
      alert('Bill info copied to clipboard!')
    }
  }

  const rateLabel = ['AP','MAP','CP'].includes(b.planType)
    ? `${b.guests} person${b.guests > 1 ? 's' : ''} x ${rs(b.ratePerUnit)}/head x ${nights} night${nights > 1 ? 's' : ''}`
    : `${b.rooms} room${b.rooms > 1 ? 's' : ''} x ${rs(b.ratePerUnit)}/room x ${nights} night${nights > 1 ? 's' : ''}`

  if (step === 'gst') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '360px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 800, color: '#1B3A2D', marginBottom: '6px' }}>Generate Bill</div>
          <div style={{ fontSize: '12px', color: '#718096', marginBottom: '20px' }}>Enter GST number if applicable</div>

          <label style={{ fontSize: '12px', fontWeight: 600, color: '#4A5568', display: 'block', marginBottom: '6px' }}>
            GST Number <span style={{ color: '#718096', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. 22AAAAA0000A1Z5"
            value={gstNo}
            onChange={e => setGstNo(e.target.value.toUpperCase())}
            maxLength={15}
            style={{ width: '100%', border: '1.5px solid #D1DDD4', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#1B3A2D', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.05em' }}
          />

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1.5px solid #D1DDD4', background: '#fff', color: '#4A5568', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
            <button onClick={() => setStep('bill')} style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: '#1B3A2D', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Proceed →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="slide-up">
        <div style={{ width: 40, height: 4, background: '#D1DDD4', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #EAF0EC', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: '#1B3A2D', fontWeight: 800, marginBottom: '10px' }}>Invoice / Bill</div>
          {/* Action buttons at the top */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={downloadBill} style={btnGreen}>⬇ Download</button>
            <button onClick={shareBill} style={btnGold}>Share</button>
            <button onClick={onClose} style={btnOutline}>Close</button>
          </div>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Bill preview */}
          <div id="bill-content" style={{ background: '#fff', border: '2px dashed #D1DDD4', borderRadius: '12px', padding: '24px', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', color: '#1B3A2D', fontWeight: 800, letterSpacing: 0 }}>StayTrack</div>
                <div style={{ fontSize: '11px', color: '#718096' }}>Hotel Booking Management</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1B3A2D' }}>{invNo}</div>
                <div style={{ fontSize: '11px', color: '#718096' }}>Date: {fmtDate(new Date())}</div>
                {gstNo && <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>GSTIN: {gstNo}</div>}
              </div>
            </div>

            {/* Bill to / Property */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#4A5568', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Bill To</div>
                <div style={{ fontWeight: 600 }}>{b.guestName}</div>
                <div style={{ color: '#718096' }}>Ph: {b.phone}</div>
                {b.email && <div style={{ color: '#718096' }}>{b.email}</div>}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#4A5568', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Property</div>
                <div style={{ fontWeight: 600 }}>{b.hotel.name}</div>
                <div style={{ color: '#718096' }}>{b.hotel.location}</div>
                <div style={{ color: '#718096' }}>Check-in: {fmtDate(b.checkin)}</div>
                <div style={{ color: '#718096' }}>Check-out: {fmtDate(b.checkout)}</div>
              </div>
            </div>

            {/* Line items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', margin: '16px 0' }}>
              <thead>
                <tr style={{ background: '#EAF0EC' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#4A5568', fontSize: '11px', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#4A5568', fontSize: '11px', textTransform: 'uppercase' }}>Plan</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#4A5568', fontSize: '11px', textTransform: 'uppercase' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', color: '#4A5568' }}>
                    Accommodation · {b.hotel.name}<br />
                    <span style={{ fontSize: '11px', color: '#718096' }}>{rateLabel}</span>
                  </td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', color: '#4A5568', fontSize: '11px' }}>{getPlanLabel(b.planType)}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', textAlign: 'right', fontWeight: 600 }}>{rs(b.subtotal)}</td>
                </tr>
                {b.taxPercent > 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', color: '#718096', fontSize: '11px' }}>GST / Tax ({b.taxPercent}%)</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', textAlign: 'right', color: '#718096' }}>{rs(b.taxAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ maxWidth: '240px', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span>Total Cost</span><span>{rs(b.totalCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span>Advance Paid</span><span style={{ color: '#1E7E4E' }}>- {rs(b.advance)}</span>
              </div>
              {b.payments.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span>Additional Paid</span><span style={{ color: '#1E7E4E' }}>- {rs(b.payments.reduce((s, p) => s + p.amount, 0))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: '15px', fontWeight: 800, color: '#1B3A2D', borderTop: '2px solid #1B3A2D', marginTop: '4px' }}>
                <span>Balance Due</span><span style={{ color: pending > 0 ? '#C0392B' : '#1E7E4E' }}>{pending > 0 ? rs(pending) : 'Rs. 0 (Cleared)'}</span>
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #EAF0EC', fontSize: '11px', color: '#718096', textAlign: 'center' }}>
              Thank you for choosing {b.hotel.name}! | Generated by StayTrack | Ref: {b.bookingRef}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

const btnGreen: React.CSSProperties = { background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnGold: React.CSSProperties = { background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
