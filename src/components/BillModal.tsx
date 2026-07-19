'use client'
import { useState } from 'react'
import { fmtINR, fmtDate, nightsBetween, getPlanLabel } from '@/lib/utils'
import { showToast } from '@/components/Toast'
import { useAppName, useAppSubName } from '@/components/AppNameProvider'

interface Payment { amount: number }
interface Booking {
  id: string; bookingRef: string; guestName: string; phone: string; email?: string;
  hotel: { name: string; location: string; managerName?: string | null; managerPhone?: string | null };
  checkin: string; checkout: string;
  planType: string; roomType?: string | null; guests: number; childGuests?: number; childRate?: number; rooms: number; ratePerUnit: number;
  subtotal: number; taxPercent: number; taxAmount: number; totalCost: number;
  advance: number; payments: Payment[];
  cancelled?: boolean; refundAmount?: number;
  notes?: string | null;
}

// PDF-safe currency: jsPDF Helvetica has no Rs symbol (U+20B9)
function rs(n: number) {
  return 'Rs. ' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function BillModal({ booking: b, paid, pending, onClose, onEditBooking }: {
  booking: Booking; paid: number; pending: number; onClose: () => void
  // When provided, shows an "Edit Booking" button that jumps to the booking edit form
  onEditBooking?: () => void
}) {
  const appName = useAppName()
  const appSubName = useAppSubName()
  const [step, setStep] = useState<'gst' | 'bill'>('gst')
  const [gstNo, setGstNo] = useState('')
  const [editing, setEditing] = useState(false)

  const nights = nightsBetween(b.checkin, b.checkout)
  const invNo = 'INV-' + b.bookingRef
  // Child charge is included in subtotal; split it back out as its own line item
  const childAmount = (b.childGuests ?? 0) * (b.childRate ?? 0) * nights

  function downloadBill() {
    // Exit edit mode and let React repaint (drops the gold border/caret) before capturing
    if (editing) setEditing(false)
    setTimeout(capturePdf, editing ? 50 : 0)
  }

  function capturePdf() {
    const el = document.getElementById('bill-content')
    if (!el) return
    showToast('Preparing PDF…')
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      doc.html(el, {
        callback: (d) => {
          d.save(`${invNo}-${b.guestName}.pdf`)
          showToast(`Bill ${invNo} downloaded ✓`)
        },
        x: 20, y: 20, width: 555, windowWidth: 650,
      })
    }).catch(() => showToast('Failed to generate PDF'))
  }

  async function shareBill() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Invoice ${invNo}`, text: `Bill for ${b.guestName} — ${fmtINR(b.totalCost)}` })
        showToast('Bill shared ✓')
      } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(`Invoice ${invNo} for ${b.guestName}: Total ${fmtINR(b.totalCost)}, Balance due ${fmtINR(pending)}`)
      showToast('Bill info copied to clipboard ✓')
    }
  }

  const roomTypeLabel = b.roomType ? ` (${b.roomType === 'DELUXE' ? 'Deluxe AC' : 'Standard Non-AC'})` : ''
  const rateLabel = ['AP','MAP','CP'].includes(b.planType)
    ? `${b.guests} person${b.guests > 1 ? 's' : ''} x ${rs(b.ratePerUnit)}/head x ${nights} night${nights > 1 ? 's' : ''}${roomTypeLabel} · ${b.rooms} room${b.rooms > 1 ? 's' : ''}`
    : `${b.rooms} room${b.rooms > 1 ? 's' : ''}${roomTypeLabel} x ${rs(b.ratePerUnit)}/room x ${nights} night${nights > 1 ? 's' : ''}`

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
            <button onClick={() => { setStep('bill'); showToast(`Bill ${invNo} generated ✓`) }} style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: '#1B3A2D', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={downloadBill} style={btnGreen}>⬇ Download</button>
            <button
              onClick={() => {
                if (!editing) showToast('Tap any text on the bill to edit it')
                setEditing(e => !e)
              }}
              style={editing ? btnGreen : btnOutline}
            >
              {editing ? '✓ Done' : '✏ Edit Text'}
            </button>
            {onEditBooking && <button onClick={onEditBooking} style={btnOutline}>📝 Edit Booking</button>}
            <button onClick={shareBill} style={btnGold}>Share</button>
            <button onClick={onClose} style={btnOutline}>Close</button>
          </div>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Bill preview — contentEditable lets the user tweak any text in place; the PDF is
              rendered from this same DOM, so edits flow into the download */}
          <div
            id="bill-content"
            contentEditable={editing}
            suppressContentEditableWarning
            style={{ background: '#fff', border: editing ? '2px dashed #C9A84C' : '2px dashed #D1DDD4', borderRadius: '12px', padding: '24px', marginBottom: '16px', fontFamily: 'Inter, sans-serif', outline: 'none' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                {/* PDF-safe font: jsPDF doc.html only draws built-in fonts — Syne metrics leave big word gaps */}
                <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '18px', color: '#1B3A2D', fontWeight: 800, letterSpacing: 0 }}>{appName}</div>
                {appSubName && <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '11px', color: '#718096' }}>{appSubName}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {b.cancelled && <div style={{ fontWeight: 800, fontSize: '13px', color: '#C0392B', border: '2px solid #C0392B', borderRadius: '4px', padding: '2px 8px', display: 'inline-block', marginBottom: '4px' }}>CANCELLED</div>}
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
                {b.hotel.managerName && <div style={{ color: '#718096' }}>Manager: {b.hotel.managerName}</div>}
                {b.hotel.managerPhone && <div style={{ color: '#718096' }}>Manager Ph: {b.hotel.managerPhone}</div>}
                <div style={{ color: '#718096' }}>Check-in: {fmtDate(b.checkin)}</div>
                <div style={{ color: '#718096' }}>Check-out: {fmtDate(b.checkout)}</div>
                <div style={{ color: '#718096' }}>Rooms: {b.rooms}</div>
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
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', textAlign: 'right', fontWeight: 600 }}>{rs(b.subtotal - childAmount)}</td>
                </tr>
                {childAmount > 0 && (
                  <tr>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', color: '#4A5568' }}>
                      Children<br />
                      <span style={{ fontSize: '11px', color: '#718096' }}>{b.childGuests} child{(b.childGuests ?? 0) > 1 ? 'ren' : ''} x {rs(b.childRate ?? 0)}/day x {nights} night{nights > 1 ? 's' : ''}</span>
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC' }} />
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #EAF0EC', textAlign: 'right', fontWeight: 600 }}>{rs(childAmount)}</td>
                  </tr>
                )}
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

            {b.notes && (
              <div style={{ marginTop: '14px', padding: '10px 12px', background: '#F7FAF8', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ fontWeight: 700, color: '#4A5568', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
                <div style={{ color: '#4A5568', whiteSpace: 'pre-wrap' }}>{b.notes}</div>
              </div>
            )}

            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #EAF0EC', fontSize: '11px', color: '#718096', textAlign: 'center' }}>
              Thank you for choosing {b.hotel.name}! | Generated by {appName} | Ref: {b.bookingRef}
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
