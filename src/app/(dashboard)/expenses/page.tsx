'use client'
import { useEffect, useState, useCallback } from 'react'
import { fmtINR, fmtDate, PAYMENT_MODES, getPaymentModeLabel, EXPENSE_CATEGORIES } from '@/lib/utils'
import { showToast } from '@/components/Toast'

interface Hotel { id: string; name: string; location: string }
interface Expense {
  id: string; date: string; category: string; description?: string | null;
  amount: number; spentBy: string; paymentMode: string;
  hotel: Hotel; createdBy: { name: string };
  booking?: { bookingRef: string } | null;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ExpensesPage() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Filters — default: current month, all hotels
  const now = new Date()
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [hotelFilter, setHotelFilter] = useState('')

  const [form, setForm] = useState({
    date: toISO(new Date()), hotelId: '', category: EXPENSE_CATEGORIES[0],
    description: '', amount: '', spentBy: '', paymentMode: 'CASH',
  })

  useEffect(() => {
    fetch('/api/hotels').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setHotels(d)
        // Staff see only their hotel — pre-select it
        if (d.length === 1) setForm(f => ({ ...f, hotelId: d[0].id }))
      }
    })
  }, [])

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    const [y, m] = month.split('-').map(Number)
    const from = toISO(new Date(y, m - 1, 1))
    const to = toISO(new Date(y, m, 0))
    const params = new URLSearchParams({ from, to })
    if (hotelFilter) params.set('hotelId', hotelFilter)
    const res = await fetch(`/api/expenses?${params}`)
    const data = await res.json()
    setExpenses(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [month, hotelFilter])

  useEffect(() => { loadExpenses() }, [loadExpenses])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function saveExpense() {
    if (!form.date || !form.hotelId || !form.category || !form.amount || !form.spentBy) {
      showToast('Fill date, hotel, category, amount and staff name'); return
    }
    if (form.date > toISO(new Date())) {
      showToast('Expense date cannot be in the future'); return
    }
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(data.error ?? 'Failed to save'); return }
    showToast('Expense added!')
    setForm(f => ({ ...f, description: '', amount: '', spentBy: '' }))
    setShowForm(false)
    loadExpenses()
  }

  async function deleteExpense(e: Expense) {
    if (!confirm(`Delete expense of ${fmtINR(e.amount)} (${e.category})?`)) return
    const res = await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Failed to delete'); return }
    showToast('Expense deleted')
    loadExpenses()
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Per-hotel totals for the current filter
  const hotelTotals = hotels
    .map(h => ({ ...h, total: expenses.filter(e => e.hotel.id === h.id).reduce((s, e) => s + e.amount, 0) }))
    .filter(h => h.total > 0)

  return (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>Expenses</div>
            <div style={{ fontSize: '12px', color: '#718096' }}>Hotel-wise expense management</div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={btnGreen}>{showForm ? 'Close' : '+ Add Expense'}</button>
        </div>

        {/* Add expense form */}
        {showForm && (
          <div style={{ ...card, marginBottom: '16px' }}>
            <div style={secTitle}>New Expense</div>
            <div style={row2}>
              <div style={group}>
                <label style={lbl}>Date *</label>
                <input style={{ ...inp, width: '85%' }} type="date" value={form.date} max={toISO(new Date())} onChange={e => set('date', e.target.value)} />
              </div>
              <div style={group}>
                <label style={lbl}>Hotel *</label>
                <select style={inp} value={form.hotelId} onChange={e => set('hotelId', e.target.value)}>
                  <option value="">Select hotel</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name} · {h.location}</option>)}
                </select>
              </div>
            </div>
            <div style={row2}>
              <div style={group}>
                <label style={lbl}>Category *</label>
                <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={group}>
                <label style={lbl}>Amount (₹) *</label>
                <input style={inp} type="number" min="1" placeholder="e.g. 2500" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
            </div>
            <div style={group}>
              <label style={lbl}>Description</label>
              <input style={inp} placeholder="e.g. Vegetables & dairy for kitchen" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div style={row2}>
              <div style={group}>
                <label style={lbl}>Spent By (Staff) *</label>
                <input style={inp} placeholder="Staff name" value={form.spentBy} onChange={e => set('spentBy', e.target.value)} />
              </div>
              <div style={group}>
                <label style={lbl}>Payment Mode *</label>
                <select style={inp} value={form.paymentMode} onChange={e => set('paymentMode', e.target.value)}>
                  {PAYMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={saveExpense} disabled={saving} style={btnGreen}>{saving ? 'Saving…' : 'Save Expense'}</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ ...inp, width: 'auto', padding: '7px 10px', fontSize: '13px' }} />
          <select value={hotelFilter} onChange={e => setHotelFilter(e.target.value)} style={{ ...inp, width: 'auto', flex: 1, minWidth: 0, padding: '7px 10px', fontSize: '13px' }}>
            <option value="">All Hotels</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>

        {/* Total card */}
        <div style={{ ...card, marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Expenses · {expenses.length} entries</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', color: '#C0392B', fontWeight: 800, marginTop: '2px' }}>{fmtINR(total)}</div>
          </div>
          {!hotelFilter && hotelTotals.length > 1 && (
            <div style={{ fontSize: '12px', color: '#4A5568', textAlign: 'right' }}>
              {hotelTotals.map(h => (
                <div key={h.id}>{h.name}: <strong style={{ color: '#1B3A2D' }}>{fmtINR(h.total)}</strong></div>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#718096', padding: '40px', fontSize: '14px' }}>Loading…</div>
        ) : expenses.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#718096', padding: '40px', fontSize: '14px' }}>No expenses for this period</div>
        ) : expenses.map(e => (
          <div key={e.id} style={{ ...card, padding: '14px 16px', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#1B3A2D' }}>{e.category}</span>
                <span style={{ fontSize: '10px', background: '#EAF0EC', color: '#1B3A2D', borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>{e.hotel.name}</span>
                {e.booking?.bookingRef && <span style={{ fontSize: '10px', background: '#FDECEA', color: '#C0392B', borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>Refund · {e.booking.bookingRef}</span>}
              </div>
              {e.description && <div style={{ fontSize: '12px', color: '#4A5568', marginTop: '3px' }}>{e.description}</div>}
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '4px' }}>
                📅 {fmtDate(e.date)} · 👤 {e.spentBy} · {getPaymentModeLabel(e.paymentMode)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '15px', color: '#C0392B' }}>{fmtINR(e.amount)}</div>
              <button onClick={() => deleteExpense(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#C0392B', fontFamily: 'Inter, sans-serif', padding: 0 }}>🗑 Delete</button>
            </div>
          </div>
        ))}
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
const btnGreen: React.CSSProperties = { background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
