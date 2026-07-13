'use client'
import { useState } from 'react'
import { fmtDate } from '@/lib/utils'
import { showToast } from './Toast'
import { useAppName } from '@/components/AppNameProvider'

interface Booking {
  id: string; bookingRef: string; guestName: string; phone: string;
  hotel: { name: string; location: string; tourismFee?: number | null; managerName?: string | null; managerPhone?: string | null };
  checkin: string; checkout: string; guests: number;
}

// PDF-safe currency: jsPDF Helvetica has no Rs symbol (U+20B9)
function rs(n: number) {
  return 'Rs. ' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function TourismBillModal({ booking: b, onClose }: { booking: Booking; onClose: () => void }) {
  const appName = useAppName()
  const [step, setStep] = useState<'input' | 'bill'>('input')
  const [feeInput, setFeeInput] = useState(b.hotel.tourismFee ? String(b.hotel.tourismFee) : '')
  const [guestsInput, setGuestsInput] = useState(String(b.guests))
  const [gstNo, setGstNo] = useState('')

  const fee = Number(feeInput) || 0
  const guests = Number(guestsInput) || 0
  const total = fee * guests
  const billNo = 'TF-' + b.bookingRef

  function generate() {
    if (!fee || fee <= 0) { showToast('Enter the fee per guest'); return }
    if (!guests || guests <= 0) { showToast('Enter number of people'); return }
    setStep('bill')
  }

  function downloadBill() {
    const el = document.getElementById('tourism-bill-content')
    if (!el) return
    showToast('Preparing PDF…')
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      doc.html(el, {
        callback: (d) => {
          d.save(`${billNo}-${b.guestName}.pdf`)
          showToast(`Tourism bill ${billNo} downloaded ✓`)
        },
        x: 20, y: 20, width: 555, windowWidth: 650,
      })
    }).catch(() => showToast('Failed to generate PDF'))
  }

  if (step === 'input') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '360px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 800, color: '#1B3A2D', marginBottom: '6px' }}>State Tourism Fee Bill</div>
          <div style={{ fontSize: '12px', color: '#718096', marginBottom: '20px' }}>
            {b.hotel.name.trim()} · {b.guestName} · {b.bookingRef}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={inputLbl}>Fee Per Guest (₹) *</label>
            <input
              style={inputBox}
              type="number"
              min="1"
              placeholder="e.g. 50"
              value={feeInput}
              onChange={e => setFeeInput(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={inputLbl}>Number of People *</label>
            <input
              style={inputBox}
              type="number"
              min="1"
              placeholder="e.g. 2"
              value={guestsInput}
              onChange={e => setGuestsInput(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={inputLbl}>GST Number <span style={{ color: '#718096', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
            <input
              style={inputBox}
              type="text"
              placeholder="e.g. 22AAAAA0000A1Z5"
              value={gstNo}
              onChange={e => setGstNo(e.target.value.toUpperCase())}
            />
          </div>

          {fee > 0 && guests > 0 && (
            <div style={{ background: '#EAF0EC', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1B3A2D', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              {guests} × ₹{fee.toLocaleString('en-IN')} = ₹{total.toLocaleString('en-IN')}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={generate} style={{ ...btnGold, flex: 2, padding: '11px' }}>Generate Bill</button>
            <button onClick={onClose} style={{ ...btnOutline, flex: 1, padding: '11px' }}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #EAF0EC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '17px', fontWeight: 800, color: '#1B3A2D' }}>State Tourism Fee Bill</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep('input')} style={btnOutline}>← Edit</button>
            <button onClick={downloadBill} style={btnGold}>⬇ PDF</button>
            <button onClick={onClose} style={btnOutline}>Close</button>
          </div>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div id="tourism-bill-content" style={{ background: '#fff', border: '2px dashed #D1DDD4', borderRadius: '12px', padding: '24px', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                {/* PDF-safe font: jsPDF doc.html only draws built-in fonts — Syne metrics leave big word gaps */}
                <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '18px', color: '#1B3A2D', fontWeight: 800 }}>{appName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#1B3A2D' }}>{billNo}</div>
                <div style={{ fontSize: '11px', color: '#718096' }}>Date: {fmtDate(new Date())}</div>
                {gstNo && <div style={{ fontSize: '11px', color: '#718096', marginTop: '2px' }}>GSTIN: {gstNo.trim()}</div>}
              </div>
            </div>

            <div style={{ background: '#EAF0EC', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#1B3A2D', textAlign: 'center', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              State Tourism Fee : One-Time Charge Per Guest
            </div>

            {/* Guest / stay details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#4A5568', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Guest</div>
                <div style={{ fontWeight: 700, color: '#1B3A2D' }}>{b.guestName}</div>
                <div style={{ color: '#718096' }}>{b.phone}</div>
                <div style={{ color: '#718096' }}>Booking Ref: {b.bookingRef}</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#4A5568', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Property</div>
                <div style={{ fontWeight: 700, color: '#1B3A2D' }}>{b.hotel.name}</div>
                <div style={{ color: '#718096' }}>{b.hotel.location}</div>
                {/* PDF-safe: jsPDF Helvetica cannot render the arrow character */}
                <div style={{ color: '#718096' }}>Stay: {fmtDate(b.checkin)} to {fmtDate(b.checkout)}</div>
              </div>
            </div>

            {/* Fee table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#1B3A2D', color: '#fff' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Description</th>
                  <th style={th}>Guests</th>
                  <th style={th}>Fee / Guest</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...td, textAlign: 'left' }}>State Tourism Fee ({b.hotel.location.trim()}) - one-time</td>
                  <td style={td}>{guests}</td>
                  <td style={td}>{rs(fee)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{rs(total)}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <div style={{ background: '#1B3A2D', color: '#fff', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 800 }}>
                Total: {rs(total)}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #EAF0EC', paddingTop: '10px', fontSize: '10px', color: '#718096', textAlign: 'center' }}>
              Thank you for choosing {b.hotel.name}! | Generated by {appName} | Ref: {b.bookingRef}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '11px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }
const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid #EAF0EC', textAlign: 'center', color: '#1A2E22' }
const inputLbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#4A5568', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const inputBox: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #D1DDD4', borderRadius: '8px', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }
const btnGold: React.CSSProperties = { background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
