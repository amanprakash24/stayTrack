'use client'
import { useEffect, useState } from 'react'
import { fmtINR } from '@/lib/utils'
import { useAppFileName } from '@/components/AppNameProvider'

type PeriodKey = 'last-month' | 'current-month' | '3-months' | 'custom'

interface MonthData { label: string; revenue: number; bookings: number; collected: number; expenses: number }
interface LocationData { name: string; revenue: number }
interface PartnerData { name: string; count: number }
interface RawBooking {
  bookingRef: string; guestName: string; phone: string; location: string; hotel: string;
  totalCost: number; advance: number; paid: number; pending: number; status: string;
  checkin: string; checkout: string; createdBy: string; planType: string;
}
interface RawExpense {
  date: string; hotel: string; location: string; category: string; description: string;
  amount: number; spentBy: string; paymentMode: string; bookingRef: string;
}
interface HotelSummary {
  hotelId: string; name: string; location: string; bookings: number; revenue: number;
  income: number; expenses: number; net: number; cancelledCount: number; refundTotal: number;
}
interface Hotel { id: string; name: string; location: string }
interface Analytics {
  months: MonthData[]; locations: LocationData[]; partners: PartnerData[];
  totals: {
    revenue: number; bookings: number; collected: number; outstanding: number;
    expenses: number; net: number; cancelledBookings: number; refunds: number;
  };
  hotelSummary: HotelSummary[];
  rawBookings: RawBooking[];
  rawExpenses: RawExpense[];
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'last-month', label: 'Last Month' },
  { key: 'current-month', label: 'Current Month' },
  { key: '3-months', label: '3 Months' },
  { key: 'custom', label: 'Custom Date' },
]

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function getDateRange(p: PeriodKey): { from: string; to: string } | null {
  const today = new Date()
  if (p === 'last-month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const to = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: toISO(from), to: toISO(to) }
  }
  if (p === 'current-month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: toISO(from), to: toISO(today) }
  }
  if (p === '3-months') {
    const from = new Date(today.getFullYear(), today.getMonth() - 2, 1)
    return { from: toISO(from), to: toISO(today) }
  }
  return null
}

export default function AnalyticsPage() {
  const appFileName = useAppFileName()
  const [period, setPeriod] = useState<PeriodKey>('3-months')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [hotelFilter, setHotelFilter] = useState('')

  useEffect(() => {
    fetch('/api/hotels').then(r => r.json()).then(d => { if (Array.isArray(d)) setHotels(d) })
  }, [])

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    let url: string
    if (period === 'custom') {
      url = `/api/analytics?from=${customFrom}&to=${customTo}`
    } else {
      const range = getDateRange(period)!
      url = `/api/analytics?from=${range.from}&to=${range.to}`
    }
    if (hotelFilter) url += `&hotelId=${hotelFilter}`
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [period, customFrom, customTo, hotelFilter])

  const periodLabel =
    period === 'last-month' ? 'Last Month' :
    period === 'current-month' ? 'Current Month' :
    period === '3-months' ? '3 Months' :
    (customFrom && customTo) ? `${customFrom} to ${customTo}` : 'Custom'

  async function exportExcel() {
    if (!data) return
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()

    // Sheet 1: Hotel-wise summary
    const summaryRows = data.hotelSummary.map(h => ({
      'Hotel': h.name,
      'Location': h.location,
      'Total Bookings': h.bookings,
      'Total Revenue (Booked)': h.revenue,
      'Total Income (Collected)': h.income,
      'Total Expenses': h.expenses,
      'Net Profit/Loss': h.net,
      'Cancelled Bookings': h.cancelledCount,
      'Total Refunds': h.refundTotal,
    }))
    summaryRows.push({
      'Hotel': 'TOTAL', 'Location': '',
      'Total Bookings': data.totals.bookings,
      'Total Revenue (Booked)': data.totals.revenue,
      'Total Income (Collected)': data.totals.collected,
      'Total Expenses': data.totals.expenses,
      'Net Profit/Loss': data.totals.net,
      'Cancelled Bookings': data.totals.cancelledBookings,
      'Total Refunds': data.totals.refunds,
    })
    utils.book_append_sheet(wb, utils.json_to_sheet(summaryRows), 'Hotel Summary')

    // Sheet 2: Bookings
    const bookingRows = data.rawBookings.map(b => ({
      'Booking Ref': b.bookingRef,
      'Guest Name': b.guestName,
      'Phone': b.phone,
      'Location': b.location,
      'Hotel': b.hotel,
      'Plan': b.planType,
      'Check-in': b.checkin,
      'Check-out': b.checkout,
      'Total Cost': b.totalCost,
      'Advance': b.advance,
      'Total Paid': b.paid,
      'Pending': b.pending,
      'Status': b.status,
      'Created By': b.createdBy,
    }))
    utils.book_append_sheet(wb, utils.json_to_sheet(bookingRows), 'Bookings')

    // Sheet 3: Expenses
    const expenseRows = data.rawExpenses.map(e => ({
      'Date': e.date.slice(0, 10),
      'Hotel': e.hotel,
      'Location': e.location,
      'Category': e.category,
      'Description': e.description,
      'Amount': e.amount,
      'Spent By': e.spentBy,
      'Payment Mode': e.paymentMode,
      'Booking Ref (Refund)': e.bookingRef,
    }))
    utils.book_append_sheet(wb, utils.json_to_sheet(expenseRows), 'Expenses')

    const hotelName = hotelFilter ? hotels.find(h => h.id === hotelFilter)?.name.replace(/ /g, '-') ?? 'Hotel' : 'All-Hotels'
    writeFile(wb, `${appFileName}-${hotelName}-${periodLabel.replace(/ /g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const maxRevenue = data ? Math.max(...data.months.map(m => m.revenue), 1) : 1
  const maxLoc = data ? Math.max(...data.locations.map(l => l.revenue), 1) : 1
  const maxPartner = data ? Math.max(...data.partners.map(p => p.count), 1) : 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>Analytics</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>Revenue & occupancy overview</div>
        </div>
        <button onClick={exportExcel} style={btnOutline}>⬇ Export Excel</button>
      </div>

      {/* Hotel filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button onClick={() => setHotelFilter('')} style={hotelChip(!hotelFilter)}>All Hotels</button>
        {hotels.map(h => (
          <button key={h.id} onClick={() => setHotelFilter(h.id)} style={hotelChip(hotelFilter === h.id)}>{h.name}</button>
        ))}
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)} style={{
            padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            border: `1.5px solid ${period === p.key ? '#1B3A2D' : '#D1DDD4'}`,
            background: period === p.key ? '#1B3A2D' : '#fff',
            color: period === p.key ? '#fff' : '#4A5568',
          }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          <input
            type="date" value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            style={{ ...dateInp, flex: 1 }}
          />
          <span style={{ fontSize: '12px', color: '#718096' }}>to</span>
          <input
            type="date" value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            style={{ ...dateInp, flex: 1 }}
          />
        </div>
      )}
      {period !== 'custom' && <div style={{ marginBottom: '6px' }} />}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#718096', padding: '40px' }}>Loading…</div>
      ) : data && (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Total Income (Collected)', value: fmtINR(data.totals.collected), style: { color: '#1E7E4E' } },
              { label: 'Total Expenses', value: fmtINR(data.totals.expenses), style: { color: '#C0392B' } },
              { label: 'Net Profit/Loss', value: fmtINR(data.totals.net), style: { color: data.totals.net >= 0 ? '#1E7E4E' : '#C0392B' } },
              { label: 'Bookings', value: data.totals.bookings, style: {} },
              { label: 'Total Revenue (Booked)', value: fmtINR(data.totals.revenue), style: {} },
              { label: 'Outstanding', value: fmtINR(data.totals.outstanding), style: { color: '#B7791F' } },
              { label: 'Cancelled Bookings', value: data.totals.cancelledBookings, style: { color: '#C0392B' } },
              { label: 'Total Refunds', value: fmtINR(data.totals.refunds), style: { color: '#C0392B' } },
            ].map(s => (
              <div key={s.label} style={statCard}>
                <div style={{ fontSize: '11px', color: '#718096', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{s.label}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', color: '#1B3A2D', marginTop: '2px', ...s.style }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Hotel-wise P&L summary */}
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)', marginBottom: '14px' }}>
            <div style={{ padding: '16px 16px 12px', fontWeight: 700, fontSize: '13px', color: '#1B3A2D', borderBottom: '1px solid #EAF0EC' }}>
              Hotel-wise Summary · {periodLabel}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#EAF0EC' }}>
                    {['Hotel', 'Bookings', 'Income', 'Expenses', 'Net P/L', 'Cancelled', 'Refunds'].map(h => (
                      <th key={h} style={{ padding: '8px', textAlign: h === 'Hotel' ? 'left' : 'right', color: '#4A5568', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.hotelSummary.map(h => (
                    <tr key={h.hotelId} style={{ borderBottom: '1px solid #EAF0EC' }}>
                      <td style={{ padding: '8px', fontWeight: 600, whiteSpace: 'nowrap' as const }}>{h.name}<div style={{ fontSize: '10px', color: '#718096', fontWeight: 400 }}>{h.location}</div></td>
                      <td style={{ padding: '8px', textAlign: 'right' as const }}>{h.bookings}</td>
                      <td style={{ padding: '8px', textAlign: 'right' as const, color: '#1E7E4E' }}>{fmtINR(h.income)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' as const, color: '#C0392B' }}>{fmtINR(h.expenses)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' as const, fontWeight: 700, color: h.net >= 0 ? '#1E7E4E' : '#C0392B' }}>{fmtINR(h.net)}</td>
                      <td style={{ padding: '8px', textAlign: 'right' as const }}>{h.cancelledCount || '—'}</td>
                      <td style={{ padding: '8px', textAlign: 'right' as const, color: '#C0392B' }}>{h.refundTotal > 0 ? fmtINR(h.refundTotal) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue bar chart */}
          <div style={chartCard}>
            <div style={chartTitle}>Monthly Revenue (₹)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
              {data.months.map(m => {
                const h = Math.max(4, Math.round((m.revenue / maxRevenue) * 112))
                return (
                  <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ fontSize: '9px', color: '#718096' }}>{m.revenue > 0 ? (m.revenue / 100000).toFixed(1) + 'L' : ''}</div>
                    <div title={`₹${m.revenue.toLocaleString('en-IN')}`} style={{ width: '100%', height: `${h}px`, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg,#C9A84C,#b5923e)', minHeight: '4px' }} />
                    <div style={{ fontSize: '10px', color: '#718096', textAlign: 'center' }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bookings bar chart */}
          <div style={chartCard}>
            <div style={chartTitle}>Monthly Bookings</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
              {data.months.map(m => {
                const maxB = Math.max(...data.months.map(x => x.bookings), 1)
                const h = Math.max(4, Math.round((m.bookings / maxB) * 72))
                return (
                  <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ fontSize: '9px', color: '#718096' }}>{m.bookings || ''}</div>
                    <div style={{ width: '100%', height: `${h}px`, borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg,#1B3A2D,#2d6a4f)', minHeight: '4px' }} />
                    <div style={{ fontSize: '10px', color: '#718096', textAlign: 'center' }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Revenue by location */}
          <div style={chartCard}>
            <div style={chartTitle}>Revenue by Location</div>
            {data.locations.map(l => (
              <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '80px', fontSize: '12px', fontWeight: 600, color: '#4A5568' }}>{l.name}</div>
                <div style={{ flex: 1, background: '#EAF0EC', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '4px', background: '#1B3A2D', width: `${Math.round(l.revenue / maxLoc * 100)}%` }} />
                </div>
                <div style={{ width: '70px', fontSize: '12px', color: '#1B3A2D', fontWeight: 700, textAlign: 'right' as const }}>
                  {l.revenue > 0 ? (l.revenue / 100000).toFixed(1) + 'L' : '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Bookings by partner */}
          <div style={chartCard}>
            <div style={chartTitle}>Bookings by Partner</div>
            {data.partners.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '80px', fontSize: '12px', fontWeight: 600, color: '#4A5568' }}>{p.name.split(' ')[0]}</div>
                <div style={{ flex: 1, background: '#EAF0EC', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '4px', background: '#C9A84C', width: `${Math.round(p.count / maxPartner * 100)}%` }} />
                </div>
                <div style={{ width: '70px', fontSize: '12px', color: '#C9A84C', fontWeight: 700, textAlign: 'right' as const }}>{p.count} bookings</div>
              </div>
            ))}
          </div>

          {/* Detailed report table */}
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)', marginTop: '14px' }}>
            <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #EAF0EC' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1B3A2D' }}>Detailed Report · {periodLabel}</div>
              <button onClick={exportExcel} style={{ background: '#C9A84C', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Download Excel
              </button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#EAF0EC' }}>
                    {['Ref', 'Client', 'Phone', 'Location', 'Total', 'Advance', 'Paid', 'Pending', 'Status', 'Partner'].map(h => (
                      <th key={h} style={{ padding: '8px', textAlign: ['Total', 'Advance', 'Paid', 'Pending'].includes(h) ? 'right' : 'left', color: '#4A5568', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rawBookings.map(b => {
                    const sColor = b.status === 'PAID' ? '#1E7E4E' : b.status === 'PARTIAL' ? '#B7791F' : '#C0392B'
                    return (
                      <tr key={b.bookingRef} style={{ borderBottom: '1px solid #EAF0EC' }}>
                        <td style={{ padding: '8px', color: '#718096', whiteSpace: 'nowrap' as const }}>{b.bookingRef}</td>
                        <td style={{ padding: '8px', fontWeight: 500 }}>{b.guestName}</td>
                        <td style={{ padding: '8px', color: '#718096' }}>{b.phone}</td>
                        <td style={{ padding: '8px' }}>{b.location}</td>
                        <td style={{ padding: '8px', textAlign: 'right' as const }}>{fmtINR(b.totalCost)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' as const, color: '#1E7E4E' }}>{fmtINR(b.advance)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' as const, color: '#1E7E4E' }}>{fmtINR(b.paid)}</td>
                        <td style={{ padding: '8px', textAlign: 'right' as const, color: '#C0392B' }}>{b.pending > 0 ? fmtINR(b.pending) : '—'}</td>
                        <td style={{ padding: '8px' }}><span style={{ color: sColor, fontWeight: 600 }}>{b.status}</span></td>
                        <td style={{ padding: '8px', color: '#718096', whiteSpace: 'nowrap' as const }}>{b.createdBy.split(' ')[0]}</td>
                      </tr>
                    )
                  })}
                  {data.rawBookings.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#718096' }}>No bookings in this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {period === 'custom' && (!customFrom || !customTo) && !loading && (
        <div style={{ textAlign: 'center', color: '#718096', padding: '40px', fontSize: '13px' }}>
          Select a start and end date to view analytics
        </div>
      )}
    </div>
  )
}

const statCard: React.CSSProperties = { background: '#fff', borderRadius: '10px', padding: '14px 16px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)' }
const chartCard: React.CSSProperties = { background: '#fff', borderRadius: '10px', border: '1px solid #D1DDD4', padding: '20px', marginBottom: '14px', boxShadow: '0 2px 12px rgba(27,58,45,0.08)' }
const chartTitle: React.CSSProperties = { fontWeight: 700, fontSize: '13px', color: '#1B3A2D', marginBottom: '16px' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const dateInp: React.CSSProperties = { border: '1.5px solid #D1DDD4', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#1B3A2D', outline: 'none', minWidth: '130px' }
const hotelChip = (active: boolean): React.CSSProperties => ({
  whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
  border: `1.5px solid ${active ? '#1B3A2D' : '#D1DDD4'}`,
  background: active ? '#1B3A2D' : '#fff', color: active ? '#fff' : '#4A5568',
  cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})
