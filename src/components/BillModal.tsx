'use client'
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

export default function BillModal({ booking: b, paid, pending, onClose }: {
  booking: Booking; paid: number; pending: number; onClose: () => void
}) {
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
    ? `${b.guests} person${b.guests > 1 ? 's' : ''} × ${fmtINR(b.ratePerUnit)}/head × ${nights} night${nights > 1 ? 's' : ''}`
    : `${b.rooms} room${b.rooms > 1 ? 's' : ''} × ${fmtINR(b.ratePerUnit)}/room × ${nights} night${nights > 1 ? 's' : ''}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: '640px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="slide-up">
        <div style={{ width: 40, height: 4, background: '#D1DDD4', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #EAF0EC', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', color: '#1B3A2D', fontWeight: 800 }}>Invoice / Bill</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>Preview before downloading</div>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Bill preview */}
          <div id="bill-content" style={{ background: '#fff', border: '2px dashed #D1DDD4', borderRadius: '12px', padding: '24px', marginBottom: '16px', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', color: '#1B3A2D', fontWeight: 800 }}>Stay<span style={{ color: '#C9A84C' }}>Track</span></div>
                <div style={{ fontSize: '11px', color: '#718096' }}>Hotel Booking Management</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1B3A2D' }}>{invNo}</div>
                <div style={{ fontSize: '11px', color: '#718096' }}>Date: {fmtDate(new Date())}</div>
              </div>
            </div>

            {/* Bill to / Property */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#4A5568', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Bill To</div>
                <div style={{ fontWeight: 600 }}>{b.guestName}</div>
                <div style={{ color: '#718096' }}>📞 {b.phone}</div>
                {b.email && <div style={{ color: '#718096' }}>{b.email}</div>}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#4A5568', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Property</div>
                <div style={{ fontWeight: 600 }}>{b.hotel.name}</div>
                <div style={{ color: '#718096' }}>📍 {b.hotel.location}</div>
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
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', textAlign: 'right', fontWeight: 600 }}>{fmtINR(b.subtotal)}</td>
                </tr>
                {b.taxPercent > 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', color: '#718096', fontSize: '11px' }}>GST / Tax ({b.taxPercent}%)</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', textAlign: 'right', color: '#718096' }}>{fmtINR(b.taxAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ maxWidth: '240px', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span>Total Cost</span><span>{fmtINR(b.totalCost)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                <span>Advance Paid</span><span style={{ color: '#1E7E4E' }}>– {fmtINR(b.advance)}</span>
              </div>
              {b.payments.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                  <span>Additional Paid</span><span style={{ color: '#1E7E4E' }}>– {fmtINR(b.payments.reduce((s, p) => s + p.amount, 0))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: '15px', fontWeight: 800, color: '#1B3A2D', borderTop: '2px solid #1B3A2D', marginTop: '4px' }}>
                <span>Balance Due</span><span style={{ color: pending > 0 ? '#C0392B' : '#1E7E4E' }}>{pending > 0 ? fmtINR(pending) : '₹0 (Cleared)'}</span>
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #EAF0EC', fontSize: '11px', color: '#718096', textAlign: 'center' }}>
              Thank you for choosing {b.hotel.name}! · Generated by StayTrack · Ref: {b.bookingRef}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={downloadBill} style={btnGreen}>⬇ Download PDF</button>
            <button onClick={shareBill} style={btnGold}>📤 Share</button>
            <button onClick={onClose} style={btnOutline}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const btnGreen: React.CSSProperties = { background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnGold: React.CSSProperties = { background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
