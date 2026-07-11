'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { showToast } from '@/components/Toast'

interface Hotel {
  id: string; name: string; location: string; totalRooms: number;
  standardRooms?: number | null; deluxeRooms?: number | null; tourismFee?: number | null;
  managerName?: string | null; managerPhone?: string | null; active: boolean
}
interface Partner {
  id: string; name: string; location?: string; active: boolean; createdAt: string;
  passwordText?: string | null;
  hotel?: { id: string; name: string; location: string } | null
}
interface Staff {
  id: string; name: string; active: boolean; createdAt: string;
  passwordText?: string | null;
  hotel?: { id: string; name: string; location: string; code?: string | null } | null
}
interface DbUsage {
  usedBytes: number; limitBytes: number; freeBytes: number; percentUsed: number;
  tables: { name: string; bytes: number; rows: number }[];
  counts: { bookings: number; payments: number; expenses: number; auditLogs: number }
}
interface CleanupPayment {
  bookingRef: string; guestName: string; amount: number;
  mode?: string | null; receivedBy?: string | null; note?: string | null; date: string
}
interface CleanupBooking {
  bookingRef: string; guestName: string; phone: string; hotel: string; location: string;
  checkin: string; checkout: string; planType: string; guests: number; rooms: number;
  totalCost: number; advance: number; totalPaid: number; status: string;
  refundAmount: number; bookedBy?: string; createdBy: string; notes?: string | null; payments: CleanupPayment[]
}
interface CleanupExpense {
  date: string; hotel: string; location: string; category: string; description?: string | null;
  amount: number; spentBy: string; paymentMode: string; bookingRef: string
}
interface CleanupPreview {
  bookings: number; payments: number; expenses: number; auditLogs: number;
  records?: {
    bookings: CleanupBooking[];
    expenses: CleanupExpense[];
    auditLogs: { date: string; user: string; action: string }[];
  }
}

function fmtMB(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'hotels' | 'partners' | 'staff' | 'database'>('hotels')
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null)

  // Add hotel form
  const [hForm, setHForm] = useState({ name: '', location: '', totalRooms: '', standardRooms: '', deluxeRooms: '', tourismFee: '', managerName: '', managerPhone: '' })
  const [creating, setCreating] = useState(false)
  // Add partner form
  const [pForm, setPForm] = useState({ name: '', password: '', location: '', hotelId: '' })
  // Edit partner
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [editPwd, setEditPwd] = useState('')
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})

  // Staff
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [sForm, setSForm] = useState({ hotelId: '', password: '' })
  const [staffPwdEdit, setStaffPwdEdit] = useState<Record<string, string>>({})

  // Database
  const [dbUsage, setDbUsage] = useState<DbUsage | null>(null)
  const [dbLoading, setDbLoading] = useState(false)
  const [cleanRange, setCleanRange] = useState({ from: '', to: '' })
  const [cleanPreview, setCleanPreview] = useState<CleanupPreview | null>(null)
  const [cleanBusy, setCleanBusy] = useState(false)
  const [backupDone, setBackupDone] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user || d.user.role !== 'SUPERADMIN') router.push('/bookings')
    })
    loadHotels()
    loadPartners()
    loadStaff()
  }, [router])

  useEffect(() => {
    if (tab === 'database' && !dbUsage) loadDbUsage()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function loadHotels() {
    try {
      const res = await fetch('/api/hotels')
      if (!res.ok) return
      const d = await res.json()
      if (Array.isArray(d)) setHotels(d)
    } catch (e) { console.error('loadHotels', e) }
  }
  async function loadPartners() {
    try {
      const res = await fetch('/api/partners')
      if (!res.ok) return
      const d = await res.json()
      if (Array.isArray(d)) setPartners(d)
    } catch (e) { console.error('loadPartners', e) }
  }
  async function loadStaff() {
    try {
      const res = await fetch('/api/staff')
      if (!res.ok) return
      const d = await res.json()
      if (Array.isArray(d)) setStaffList(d)
    } catch (e) { console.error('loadStaff', e) }
  }
  async function loadDbUsage() {
    setDbLoading(true)
    try {
      const res = await fetch('/api/admin/db-usage')
      if (res.ok) setDbUsage(await res.json())
    } catch (e) { console.error('loadDbUsage', e) }
    setDbLoading(false)
  }

  // ── Staff actions ──
  async function addStaff() {
    if (creating) return
    if (!sForm.hotelId || !sForm.password) { showToast('Select hotel and set a password'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sForm),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Error'); return }
      showToast(`Staff account for "${data.hotel?.name}" created!`)
      setSForm({ hotelId: '', password: '' })
      loadStaff()
    } finally {
      setCreating(false)
    }
  }

  async function toggleStaff(s: Staff) {
    await fetch(`/api/staff/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !s.active }),
    })
    showToast(s.active ? 'Staff login disabled' : 'Staff login enabled')
    loadStaff()
  }

  async function saveStaffPassword(s: Staff) {
    const password = staffPwdEdit[s.id]
    if (!password) { showToast('Enter a new password'); return }
    const res = await fetch(`/api/staff/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) { showToast('Failed to update password'); return }
    showToast('Staff password updated!')
    setStaffPwdEdit(p => ({ ...p, [s.id]: '' }))
    loadStaff()
  }

  async function deleteStaff(s: Staff) {
    if (!confirm(`Delete staff account for "${s.hotel?.name ?? s.name}"?`)) return
    const res = await fetch(`/api/staff/${s.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Error deleting staff'); return }
    showToast(data.deactivated ? 'Staff has activity history — login disabled instead' : 'Staff account deleted')
    loadStaff()
  }

  // ── Database cleanup ──
  async function previewCleanup() {
    if (!cleanRange.from || !cleanRange.to) { showToast('Select both dates'); return }
    setCleanBusy(true)
    const res = await fetch('/api/admin/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cleanRange, dryRun: true }),
    })
    const data = await res.json()
    setCleanBusy(false)
    if (!res.ok) { showToast(data.error ?? 'Error'); return }
    setCleanPreview(data)
    setBackupDone(false)
  }

  async function downloadBackup() {
    const r = cleanPreview?.records
    if (!r) return
    const { utils, writeFile } = await import('xlsx')
    const wb = utils.book_new()

    utils.book_append_sheet(wb, utils.json_to_sheet(r.bookings.map(b => ({
      'Booking Ref': b.bookingRef,
      'Guest Name': b.guestName,
      'Phone': b.phone,
      'Hotel': b.hotel,
      'Location': b.location,
      'Check-in': String(b.checkin).slice(0, 10),
      'Check-out': String(b.checkout).slice(0, 10),
      'Plan': b.planType,
      'Guests': b.guests,
      'Rooms': b.rooms,
      'Total Cost': b.totalCost,
      'Advance': b.advance,
      'Total Paid': b.totalPaid,
      'Status': b.status,
      'Refund': b.refundAmount,
      'Booked By': b.bookedBy ?? '',
      'Created By': b.createdBy,
      'Notes': b.notes ?? '',
    }))), 'Bookings')

    utils.book_append_sheet(wb, utils.json_to_sheet(r.bookings.flatMap(b => b.payments).map(p => ({
      'Booking Ref': p.bookingRef,
      'Guest Name': p.guestName,
      'Amount': p.amount,
      'Mode': p.mode ?? '',
      'Received By': p.receivedBy ?? '',
      'Note': p.note ?? '',
      'Date': String(p.date).slice(0, 10),
    }))), 'Payments')

    utils.book_append_sheet(wb, utils.json_to_sheet(r.expenses.map(e => ({
      'Date': String(e.date).slice(0, 10),
      'Hotel': e.hotel,
      'Location': e.location,
      'Category': e.category,
      'Description': e.description ?? '',
      'Amount': e.amount,
      'Spent By': e.spentBy,
      'Payment Mode': e.paymentMode,
      'Booking Ref (Refund)': e.bookingRef,
    }))), 'Expenses')

    utils.book_append_sheet(wb, utils.json_to_sheet(r.auditLogs.map(l => ({
      'Date': String(l.date).slice(0, 19).replace('T', ' '),
      'User': l.user,
      'Action': l.action,
    }))), 'History Logs')

    writeFile(wb, `HappyPanorama-Backup-${cleanRange.from}-to-${cleanRange.to}.xlsx`)
    setBackupDone(true)
    showToast('Backup downloaded ✓')
  }

  async function runCleanup() {
    if (!cleanPreview) return
    const total = cleanPreview.bookings + cleanPreview.payments + cleanPreview.expenses + cleanPreview.auditLogs
    if (total === 0) { showToast('Nothing to delete in this range'); return }
    if (!confirm(`Permanently delete ${cleanPreview.bookings} booking(s), ${cleanPreview.payments} payment(s), ${cleanPreview.expenses} expense(s) and ${cleanPreview.auditLogs} log(s) from ${cleanRange.from} to ${cleanRange.to}?\n\nThis CANNOT be undone. Export your data from Analytics first if needed.`)) return
    setCleanBusy(true)
    const res = await fetch('/api/admin/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cleanRange, dryRun: false }),
    })
    const data = await res.json()
    setCleanBusy(false)
    if (!res.ok) { showToast(data.error ?? 'Error'); return }
    showToast('Old data cleared ✓')
    setCleanPreview(null)
    setCleanRange({ from: '', to: '' })
    setBackupDone(false)
    loadDbUsage()
  }

  // ── Add hotel ──
  async function addHotel() {
    if (creating) return
    if (!hForm.name || !hForm.location || !hForm.totalRooms) { showToast('Fill name, location, and rooms'); return }
    if (hForm.standardRooms || hForm.deluxeRooms) {
      const sum = (Number(hForm.standardRooms) || 0) + (Number(hForm.deluxeRooms) || 0)
      if (sum !== Number(hForm.totalRooms)) {
        showToast(`Standard + Deluxe rooms (${sum}) must equal total rooms (${hForm.totalRooms})`); return
      }
    }
    setCreating(true)
    try {
      const res = await fetch('/api/hotels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hForm),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Error'); return }
      showToast(`Hotel "${data.name}" added!`)
      setHForm({ name: '', location: '', totalRooms: '', standardRooms: '', deluxeRooms: '', tourismFee: '', managerName: '', managerPhone: '' })
      loadHotels()
    } finally {
      setCreating(false)
    }
  }

  // ── Save hotel edit ──
  async function saveEdit() {
    if (!editingHotel) return
    if (!editingHotel.name || !editingHotel.location || !editingHotel.totalRooms) {
      showToast('Name, location and rooms are required'); return
    }
    if (editingHotel.standardRooms || editingHotel.deluxeRooms) {
      const sum = (editingHotel.standardRooms ?? 0) + (editingHotel.deluxeRooms ?? 0)
      if (sum !== Number(editingHotel.totalRooms)) {
        showToast(`Standard + Deluxe rooms (${sum}) must equal total rooms (${editingHotel.totalRooms})`); return
      }
    }
    const res = await fetch(`/api/hotels/${editingHotel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingHotel.name,
        location: editingHotel.location,
        totalRooms: editingHotel.totalRooms,
        standardRooms: editingHotel.standardRooms ?? '',
        deluxeRooms: editingHotel.deluxeRooms ?? '',
        tourismFee: editingHotel.tourismFee ?? '',
        managerName: editingHotel.managerName,
        managerPhone: editingHotel.managerPhone,
      }),
    })
    if (!res.ok) { showToast('Failed to save'); return }
    showToast('Hotel updated!')
    setEditingHotel(null)
    loadHotels()
  }

  // ── Permanently delete hotel ──
  async function deleteHotel(h: Hotel) {
    if (!confirm(`PERMANENTLY delete "${h.name}"?\n\nThis wipes the hotel with ALL its bookings, payments, expenses and history. This CANNOT be undone.\n\nIf you just want to hide it for now, use Deactivate instead — that keeps the data and can be turned back on later.`)) return
    if (!confirm(`Last confirmation — delete "${h.name}" and all its data forever?`)) return
    const res = await fetch(`/api/hotels/${h.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Failed to delete'); return }
    showToast(`Hotel "${h.name}" permanently deleted`)
    loadHotels()
    loadStaff()
  }

  // ── Toggle hotel active ──
  async function toggleHotel(h: Hotel) {
    const action = h.active ? 'Deactivate' : 'Activate'
    if (!confirm(`${action} "${h.name}"?`)) return
    await fetch(`/api/hotels/${h.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !h.active }),
    })
    showToast(`Hotel ${h.active ? 'deactivated' : 'activated'}`)
    loadHotels()
  }

  // ── Partner actions ──
  async function addPartner() {
    if (creating) return
    if (!pForm.name || !pForm.password) { showToast('Name and password required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pForm),
      })
      const data = await res.json()
      if (!res.ok) { showToast(data.error ?? 'Error'); return }
      showToast(`Partner "${data.name}" created!`)
      setPForm({ name: '', password: '', location: '', hotelId: '' })
      loadPartners()
    } finally {
      setCreating(false)
    }
  }

  async function togglePartner(p: Partner) {
    await fetch(`/api/partners/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    showToast(p.active ? 'Partner deactivated' : 'Partner activated')
    loadPartners()
  }

  async function deletePartner(p: Partner) {
    if (!confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/partners/${p.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Error deleting partner'); return }
    showToast(`Partner "${p.name}" deleted`)
    loadPartners()
  }

  async function savePartner() {
    if (!editingPartner) return
    if (!editingPartner.name) { showToast('Name is required'); return }
    const body: Record<string, unknown> = {
      name: editingPartner.name,
      location: editingPartner.location || null,
      hotelId: editingPartner.hotel?.id || null,
    }
    if (editPwd) body.password = editPwd
    const res = await fetch(`/api/partners/${editingPartner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { showToast('Failed to save'); return }
    showToast('Partner updated!')
    setEditingPartner(null)
    setEditPwd('')
    loadPartners()
  }

  return (
    <>
      <div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>Admin Panel</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>Manage hotels & partners</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {(['hotels', 'partners', 'staff', 'database'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
              border: `1.5px solid ${tab === t ? '#1B3A2D' : '#D1DDD4'}`,
              background: tab === t ? '#1B3A2D' : '#fff',
              color: tab === t ? '#fff' : '#4A5568',
            }}>
              {t === 'hotels' ? '🏨 Hotels' : t === 'partners' ? '👥 Partners' : t === 'staff' ? '🧑‍💼 Staff' : '💾 Database'}
            </button>
          ))}
        </div>

        {/* ══ HOTELS TAB ══ */}
        {tab === 'hotels' && (
          <>
            {/* Add hotel form */}
            <div style={card}>
              <div style={secTitle}>Add New Hotel</div>
              <div style={group}>
                <label style={lbl}>Hotel Name *</label>
                <input style={inp} placeholder="e.g. Pine Ridge Resort" value={hForm.name} onChange={e => setHForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Location *</label>
                  <input style={inp} placeholder="e.g. Darjeeling" value={hForm.location} onChange={e => setHForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div style={group}>
                  <label style={lbl}>Total Rooms *</label>
                  <input style={inp} type="number" min="1" placeholder="e.g. 10" value={hForm.totalRooms} onChange={e => setHForm(f => ({ ...f, totalRooms: e.target.value }))} />
                </div>
              </div>
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Standard Non-AC Rooms (optional)</label>
                  <input style={inp} type="number" min="0" placeholder="e.g. 6" value={hForm.standardRooms} onChange={e => setHForm(f => ({ ...f, standardRooms: e.target.value }))} />
                </div>
                <div style={group}>
                  <label style={lbl}>Deluxe AC Rooms (optional)</label>
                  <input style={inp} type="number" min="0" placeholder="e.g. 4" value={hForm.deluxeRooms} onChange={e => setHForm(f => ({ ...f, deluxeRooms: e.target.value }))} />
                </div>
              </div>
              {(hForm.standardRooms || hForm.deluxeRooms) && hForm.totalRooms && ((Number(hForm.standardRooms) || 0) + (Number(hForm.deluxeRooms) || 0)) !== Number(hForm.totalRooms) && (
                <div style={{ background: '#FDECEA', color: '#C0392B', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '14px', fontWeight: 600 }}>
                  ✗ Standard ({Number(hForm.standardRooms) || 0}) + Deluxe ({Number(hForm.deluxeRooms) || 0}) = {(Number(hForm.standardRooms) || 0) + (Number(hForm.deluxeRooms) || 0)} — must equal total rooms ({hForm.totalRooms})
                </div>
              )}
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>State Tourism Fee / Guest (₹, optional)</label>
                  <input style={inp} type="number" min="0" placeholder="one-time fee per guest" value={hForm.tourismFee} onChange={e => setHForm(f => ({ ...f, tourismFee: e.target.value }))} />
                </div>
                <div />
              </div>
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Manager Name (optional)</label>
                  <input style={inp} placeholder="e.g. Ramesh Kumar" value={hForm.managerName} onChange={e => setHForm(f => ({ ...f, managerName: e.target.value }))} />
                </div>
                <div style={group}>
                  <label style={lbl}>Manager Mobile</label>
                  <input style={inp} type="tel" placeholder="10-digit number" value={hForm.managerPhone} onChange={e => setHForm(f => ({ ...f, managerPhone: e.target.value }))} />
                </div>
              </div>
              <button onClick={addHotel} disabled={creating} style={{ ...btnGreen, opacity: creating ? 0.6 : 1 }}>{creating ? 'Adding…' : '+ Add Hotel'}</button>
            </div>

            {/* Hotel list */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, color: '#718096', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Hotels ({hotels.length} total · {hotels.filter(h => h.active).length} active)
              </div>

              {hotels.map(h => (
                <div key={h.id} style={{ ...hotelCard, opacity: h.active ? 1 : 0.55 }}>
                  {editingHotel?.id === h.id ? (
                    /* ── Edit mode ── */
                    <div style={{ padding: '16px' }}>
                      <div style={{ ...secTitle, marginBottom: '12px' }}>Editing: {h.name}</div>
                      <div style={row2}>
                        <div style={group}>
                          <label style={lbl}>Hotel Name *</label>
                          <input style={inp} value={editingHotel.name} onChange={e => setEditingHotel(v => v && ({ ...v, name: e.target.value }))} />
                        </div>
                        <div style={group}>
                          <label style={lbl}>Location *</label>
                          <input style={inp} value={editingHotel.location} onChange={e => setEditingHotel(v => v && ({ ...v, location: e.target.value }))} />
                        </div>
                      </div>
                      <div style={row2}>
                        <div style={group}>
                          <label style={lbl}>Total Rooms *</label>
                          <input style={inp} type="number" min="1" value={editingHotel.totalRooms} onChange={e => setEditingHotel(v => v && ({ ...v, totalRooms: Number(e.target.value) }))} />
                        </div>
                        <div style={group}>
                          <label style={lbl}>Manager Name</label>
                          <input style={inp} placeholder="optional" value={editingHotel.managerName ?? ''} onChange={e => setEditingHotel(v => v && ({ ...v, managerName: e.target.value }))} />
                        </div>
                      </div>
                      <div style={row2}>
                        <div style={group}>
                          <label style={lbl}>Standard Non-AC Rooms</label>
                          <input style={inp} type="number" min="0" placeholder="optional" value={editingHotel.standardRooms ?? ''} onChange={e => setEditingHotel(v => v && ({ ...v, standardRooms: e.target.value === '' ? null : Number(e.target.value) }))} />
                        </div>
                        <div style={group}>
                          <label style={lbl}>Deluxe AC Rooms</label>
                          <input style={inp} type="number" min="0" placeholder="optional" value={editingHotel.deluxeRooms ?? ''} onChange={e => setEditingHotel(v => v && ({ ...v, deluxeRooms: e.target.value === '' ? null : Number(e.target.value) }))} />
                        </div>
                      </div>
                      {(editingHotel.standardRooms || editingHotel.deluxeRooms) ? (((editingHotel.standardRooms ?? 0) + (editingHotel.deluxeRooms ?? 0)) !== Number(editingHotel.totalRooms) && (
                        <div style={{ background: '#FDECEA', color: '#C0392B', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '14px', fontWeight: 600 }}>
                          ✗ Standard ({editingHotel.standardRooms ?? 0}) + Deluxe ({editingHotel.deluxeRooms ?? 0}) = {(editingHotel.standardRooms ?? 0) + (editingHotel.deluxeRooms ?? 0)} — must equal total rooms ({editingHotel.totalRooms})
                        </div>
                      )) : null}
                      <div style={row2}>
                        <div style={group}>
                          <label style={lbl}>Manager Mobile</label>
                          <input style={inp} type="tel" placeholder="10-digit number" value={editingHotel.managerPhone ?? ''} onChange={e => setEditingHotel(v => v && ({ ...v, managerPhone: e.target.value }))} />
                        </div>
                        <div style={group}>
                          <label style={lbl}>State Tourism Fee / Guest (₹)</label>
                          <input style={inp} type="number" min="0" placeholder="optional" value={editingHotel.tourismFee ?? ''} onChange={e => setEditingHotel(v => v && ({ ...v, tourismFee: e.target.value === '' ? null : Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={saveEdit} style={btnGreen}>Save Changes</button>
                        <button onClick={() => setEditingHotel(null)} style={btnOutline}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1B3A2D' }}>{h.name}</div>
                          {!h.active && <span style={{ fontSize: '10px', background: '#FDECEA', color: '#C0392B', borderRadius: '4px', padding: '2px 6px', fontWeight: 600 }}>INACTIVE</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#718096', marginTop: '3px' }}>
                          📍 {h.location} · {h.totalRooms} rooms
                          {(h.standardRooms || h.deluxeRooms) ? ` (${[h.standardRooms ? `${h.standardRooms} Std Non-AC` : '', h.deluxeRooms ? `${h.deluxeRooms} Deluxe AC` : ''].filter(Boolean).join(' + ')})` : ''}
                          {h.tourismFee ? ` · 🏞 ₹${h.tourismFee}/guest` : ''}
                          {h.managerName && ` · 👤 ${h.managerName}`}
                          {h.managerPhone && ` · 📞 ${h.managerPhone}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setEditingHotel(h)}
                          style={{ background: '#EAF0EC', color: '#1B3A2D', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >
                          ✏ Edit
                        </button>
                        <button
                          onClick={() => toggleHotel(h)}
                          style={{ background: h.active ? '#FDECEA' : '#E6F5EC', color: h.active ? '#C0392B' : '#1E7E4E', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >
                          {h.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteHotel(h)}
                          style={{ background: '#fff', color: '#C0392B', border: '1.5px solid #C0392B', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                        >
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ PARTNERS TAB ══ */}
        {tab === 'partners' && (
          <>
            <div style={card}>
              <div style={secTitle}>Create New Partner</div>
              <div style={group}>
                <label style={lbl}>Full Name *</label>
                <input style={inp} placeholder="e.g. Rahul Sharma" value={pForm.name} onChange={e => setPForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Password *</label>
                  <input style={inp} type="password" placeholder="Set login password" value={pForm.password} onChange={e => setPForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div style={group}>
                  <label style={lbl}>Location</label>
                  <input style={inp} placeholder="e.g. Darjeeling" value={pForm.location} onChange={e => setPForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              </div>
              <div style={group}>
                <label style={lbl}>Associated Hotel (optional)</label>
                <select style={inp} value={pForm.hotelId} onChange={e => setPForm(f => ({ ...f, hotelId: e.target.value }))}>
                  <option value="">— No specific hotel —</option>
                  {hotels.filter(h => h.active).map(h => (
                    <option key={h.id} value={h.id}>{h.name} · {h.location}</option>
                  ))}
                </select>
              </div>
              <button onClick={addPartner} style={btnGreen}>+ Create Partner</button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, color: '#718096', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Partners ({partners.length})
              </div>
              {partners.map(p => (
                <div key={p.id} style={{ ...hotelCard, opacity: p.active ? 1 : 0.6 }}>
                  {editingPartner?.id === p.id ? (
                    /* ── Inline edit mode ── */
                    <div style={{ padding: '14px 16px' }}>
                      <div style={group}>
                        <label style={lbl}>Name *</label>
                        <input style={inp} value={editingPartner.name} onChange={e => setEditingPartner(ep => ep ? { ...ep, name: e.target.value } : ep)} />
                      </div>
                      <div style={group}>
                        <label style={lbl}>Location</label>
                        <input style={inp} value={editingPartner.location ?? ''} onChange={e => setEditingPartner(ep => ep ? { ...ep, location: e.target.value } : ep)} />
                      </div>
                      <div style={group}>
                        <label style={lbl}>Associated Hotel</label>
                        <select style={inp} value={editingPartner.hotel?.id ?? ''} onChange={e => {
                          const h = hotels.find(h => h.id === e.target.value) ?? null
                          setEditingPartner(ep => ep ? { ...ep, hotel: h ? { id: h.id, name: h.name, location: h.location } : null } : ep)
                        }}>
                          <option value="">— No hotel —</option>
                          {hotels.filter(h => h.active).map(h => <option key={h.id} value={h.id}>{h.name} · {h.location}</option>)}
                        </select>
                      </div>
                      <div style={group}>
                        <label style={lbl}>New Password <span style={{ color: '#718096', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                        <input style={inp} type="text" placeholder="Enter new password" value={editPwd} onChange={e => setEditPwd(e.target.value)} />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button onClick={savePartner} style={btnGreen}>Save</button>
                        <button onClick={() => { setEditingPartner(null); setEditPwd('') }} style={{ ...btnGreen, background: '#718096' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    /* ── View mode ── */
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1B3A2D' }}>{p.name}</div>
                          <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                            {p.location ? `📍 ${p.location} · ` : ''}
                            <span style={{ color: p.active ? '#1E7E4E' : '#C0392B', fontWeight: 600 }}>{p.active ? 'Active' : 'Inactive'}</span>
                            {' · '}Joined {new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                          </div>
                          {p.hotel && <div style={{ fontSize: '12px', color: '#1B3A2D', fontWeight: 600, marginTop: '4px' }}>🏨 {p.hotel.name} · {p.hotel.location}</div>}
                          {p.passwordText && (
                            <div style={{ fontSize: '12px', color: '#4A5568', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#718096' }}>Password:</span>
                              <span style={{ fontWeight: 600, letterSpacing: showPwd[p.id] ? 0 : '0.1em' }}>
                                {showPwd[p.id] ? p.passwordText : '••••••••'}
                              </span>
                              <button
                                onClick={() => setShowPwd(s => ({ ...s, [p.id]: !s[p.id] }))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
                              >
                                {showPwd[p.id] ? '🙈' : '👁'}
                              </button>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          <button onClick={() => { setEditingPartner(p); setEditPwd('') }} style={{ background: '#EAF0EC', color: '#1B3A2D', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Edit</button>
                          <button onClick={() => togglePartner(p)} style={{ background: p.active ? '#FDECEA' : '#E6F5EC', color: p.active ? '#C0392B' : '#1E7E4E', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            {p.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => deletePartner(p)} style={{ background: '#fff', color: '#C0392B', border: '1.5px solid #C0392B', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>🗑 Delete</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ STAFF TAB ══ */}
        {tab === 'staff' && (
          <>
            <div style={card}>
              <div style={secTitle}>Create Staff Login</div>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '14px' }}>
                One staff account per hotel. Staff log in by choosing their hotel and entering this password —
                they only see bookings, expenses and history of their own hotel.
              </div>
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>Hotel *</label>
                  <select style={inp} value={sForm.hotelId} onChange={e => setSForm(f => ({ ...f, hotelId: e.target.value }))}>
                    <option value="">— Select hotel —</option>
                    {hotels.filter(h => h.active && !staffList.some(s => s.hotel?.id === h.id)).map(h => (
                      <option key={h.id} value={h.id}>{h.name} · {h.location}</option>
                    ))}
                  </select>
                </div>
                <div style={group}>
                  <label style={lbl}>Staff Password *</label>
                  <input style={inp} type="text" placeholder="Set login password" value={sForm.password} onChange={e => setSForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <button onClick={addStaff} style={btnGreen}>+ Create Staff Login</button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' as const, color: '#718096', letterSpacing: '0.07em', marginBottom: '12px' }}>
                Staff Accounts ({staffList.length})
              </div>
              {staffList.length === 0 && (
                <div style={{ textAlign: 'center', color: '#718096', padding: '30px', fontSize: '13px' }}>No staff accounts yet</div>
              )}
              {staffList.map(s => (
                <div key={s.id} style={{ ...hotelCard, opacity: s.active ? 1 : 0.6 }}>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1B3A2D' }}>
                          🏨 {s.hotel?.name ?? '—'} {s.hotel?.code && <span style={{ fontSize: '11px', color: '#C9A84C', fontWeight: 600 }}>· Code {s.hotel.code}</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                          {s.hotel?.location ?? ''}{' · '}
                          <span style={{ color: s.active ? '#1E7E4E' : '#C0392B', fontWeight: 600 }}>{s.active ? 'Login Enabled' : 'Login Disabled'}</span>
                        </div>
                        {s.passwordText && (
                          <div style={{ fontSize: '12px', color: '#4A5568', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#718096' }}>Password:</span>
                            <span style={{ fontWeight: 600, letterSpacing: showPwd[s.id] ? 0 : '0.1em' }}>
                              {showPwd[s.id] ? s.passwordText : '••••••••'}
                            </span>
                            <button
                              onClick={() => setShowPwd(p => ({ ...p, [s.id]: !p[s.id] }))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
                            >
                              {showPwd[s.id] ? '🙈' : '👁'}
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                          <input
                            style={{ ...inp, padding: '7px 10px', fontSize: '12px', flex: 1 }}
                            type="text"
                            placeholder="New password"
                            value={staffPwdEdit[s.id] ?? ''}
                            onChange={e => setStaffPwdEdit(p => ({ ...p, [s.id]: e.target.value }))}
                          />
                          <button onClick={() => saveStaffPassword(s)} style={{ ...btnGreen, padding: '7px 12px', fontSize: '12px' }}>Change</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => toggleStaff(s)} style={{ background: s.active ? '#FDECEA' : '#E6F5EC', color: s.active ? '#C0392B' : '#1E7E4E', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                          {s.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteStaff(s)} style={{ background: '#fff', color: '#C0392B', border: '1.5px solid #C0392B', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>🗑 Delete</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ DATABASE TAB ══ */}
        {tab === 'database' && (
          <>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ ...secTitle, marginBottom: 0 }}>Storage Used (Free Plan · 500 MB)</div>
                <button onClick={loadDbUsage} style={{ background: '#EAF0EC', color: '#1B3A2D', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  ↻ Refresh
                </button>
              </div>

              {dbLoading || !dbUsage ? (
                <div style={{ color: '#718096', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
                  {dbLoading ? 'Reading database size…' : 'Could not load usage'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: 800, color: dbUsage.percentUsed > 85 ? '#C0392B' : dbUsage.percentUsed > 60 ? '#B7791F' : '#1E7E4E' }}>
                      {fmtMB(dbUsage.usedBytes)}
                    </div>
                    <div style={{ fontSize: '13px', color: '#718096' }}>
                      {fmtMB(dbUsage.freeBytes)} free · {dbUsage.percentUsed}% used
                    </div>
                  </div>
                  {(() => {
                    const appBytes = dbUsage.tables.filter(t => t.name !== '_prisma_migrations').reduce((s, t) => s + t.bytes, 0)
                    return (
                      <div style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}>
                        Your booking data: <strong style={{ color: '#1B3A2D' }}>{fmtMB(appBytes)}</strong> · Postgres system baseline: ~{fmtMB(dbUsage.usedBytes - appBytes)} (fixed — every database uses this, even when empty). Space freed by clearing data is reclaimed automatically in the background and reused for new bookings.
                      </div>
                    )
                  })()}
                  <div style={{ background: '#EAF0EC', borderRadius: '6px', height: '12px', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{
                      height: '100%', borderRadius: '6px',
                      width: `${Math.max(2, dbUsage.percentUsed)}%`,
                      background: dbUsage.percentUsed > 85 ? '#C0392B' : dbUsage.percentUsed > 60 ? '#C9A84C' : 'linear-gradient(90deg,#1B3A2D,#52b788)',
                      transition: 'width 0.5s',
                    }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {[
                      ['Bookings', dbUsage.counts.bookings],
                      ['Payments', dbUsage.counts.payments],
                      ['Expenses', dbUsage.counts.expenses],
                      ['Logs', dbUsage.counts.auditLogs],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ textAlign: 'center', background: '#F4F7F5', borderRadius: '8px', padding: '10px 4px' }}>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 800, color: '#1B3A2D' }}>{value}</div>
                        <div style={{ fontSize: '10px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ ...card, marginTop: '16px', border: '1px solid #E7C6C0' }}>
              <div style={{ ...secTitle, color: '#C0392B' }}>Clear Old Data</div>
              <div style={{ fontSize: '12px', color: '#718096', marginBottom: '14px', lineHeight: 1.5 }}>
                Free up space by deleting old records in a date range: <strong>completed or cancelled bookings</strong> (by
                checkout date, with their payments), <strong>expenses</strong> and <strong>history logs</strong>.
                Upcoming and ongoing stays are never touched. Export reports from Analytics before clearing —
                deleted data cannot be recovered.
              </div>
              <div style={row2}>
                <div style={group}>
                  <label style={lbl}>From Date *</label>
                  <input style={{ ...inp, width: '85%' }} type="date" value={cleanRange.from} onChange={e => { setCleanRange(r => ({ ...r, from: e.target.value })); setCleanPreview(null) }} />
                </div>
                <div style={group}>
                  <label style={lbl}>To Date *</label>
                  <input style={{ ...inp, width: '85%' }} type="date" value={cleanRange.to} onChange={e => { setCleanRange(r => ({ ...r, to: e.target.value })); setCleanPreview(null) }} />
                </div>
              </div>

              {cleanPreview && (
                <div style={{ background: '#FDECEA', border: '1px solid #C0392B', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#4A5568', marginBottom: '14px' }}>
                  <div style={{ fontWeight: 700, color: '#C0392B', marginBottom: '6px' }}>Will be deleted:</div>
                  <div style={{ marginBottom: '10px' }}>
                    {cleanPreview.bookings} booking(s) · {cleanPreview.payments} payment(s) · {cleanPreview.expenses} expense(s) · {cleanPreview.auditLogs} log(s)
                  </div>

                  {/* Record details */}
                  {(cleanPreview.records?.bookings?.length ?? 0) > 0 && (
                    <>
                      <div style={cleanListTitle}>Bookings</div>
                      <div style={cleanList}>
                        {cleanPreview.records!.bookings.slice(0, 50).map(b => (
                          <div key={b.bookingRef} style={cleanListRow}>
                            <span style={{ fontWeight: 600 }}>{b.bookingRef}</span> · {b.guestName} · {b.hotel.trim()}
                            <span style={{ color: '#718096' }}> · {String(b.checkin).slice(0, 10)} → {String(b.checkout).slice(0, 10)} · ₹{b.totalCost.toLocaleString('en-IN')} · {b.status}</span>
                          </div>
                        ))}
                        {cleanPreview.records!.bookings.length > 50 && (
                          <div style={{ ...cleanListRow, color: '#718096' }}>…and {cleanPreview.records!.bookings.length - 50} more (all included in the Excel backup)</div>
                        )}
                      </div>
                    </>
                  )}

                  {(cleanPreview.records?.expenses?.length ?? 0) > 0 && (
                    <>
                      <div style={cleanListTitle}>Expenses</div>
                      <div style={cleanList}>
                        {cleanPreview.records!.expenses.slice(0, 50).map((e, i) => (
                          <div key={i} style={cleanListRow}>
                            {String(e.date).slice(0, 10)} · <span style={{ fontWeight: 600 }}>{e.category}</span> · {e.hotel.trim()}
                            <span style={{ color: '#718096' }}> · ₹{e.amount.toLocaleString('en-IN')} · by {e.spentBy}</span>
                          </div>
                        ))}
                        {cleanPreview.records!.expenses.length > 50 && (
                          <div style={{ ...cleanListRow, color: '#718096' }}>…and {cleanPreview.records!.expenses.length - 50} more (all included in the Excel backup)</div>
                        )}
                      </div>
                    </>
                  )}

                  {(cleanPreview.auditLogs ?? 0) > 0 && (
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '8px' }}>
                      + {cleanPreview.auditLogs} history log entries (full list in the Excel backup)
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!cleanPreview ? (
                  <button onClick={previewCleanup} disabled={cleanBusy} style={btnGreen}>
                    {cleanBusy ? 'Checking…' : 'Preview What Gets Deleted'}
                  </button>
                ) : (
                  <>
                    <button onClick={downloadBackup} style={{ ...btnGreen, background: backupDone ? '#1E7E4E' : '#C9A84C' }}>
                      {backupDone ? '✓ Backup Downloaded' : '⬇ Download Excel Backup'}
                    </button>
                    <button onClick={runCleanup} disabled={cleanBusy} style={{ ...btnGreen, background: '#C0392B' }}>
                      {cleanBusy ? 'Deleting…' : '🗑 Delete Permanently'}
                    </button>
                    <button onClick={() => { setCleanPreview(null); setBackupDone(false) }} style={btnOutline}>Cancel</button>
                  </>
                )}
              </div>
              {cleanPreview && !backupDone && (
                <div style={{ fontSize: '11px', color: '#B7791F', marginTop: '8px', fontWeight: 600 }}>
                  💡 Tip: download the Excel backup before deleting — deleted data cannot be recovered.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #D1DDD4', boxShadow: '0 2px 12px rgba(27,58,45,0.08)' }
const hotelCard: React.CSSProperties = { background: '#fff', borderRadius: '10px', border: '1px solid #D1DDD4', marginBottom: '8px', boxShadow: '0 2px 12px rgba(27,58,45,0.08)', overflow: 'hidden' }
const secTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#718096', marginBottom: '14px' }
const group: React.CSSProperties = { marginBottom: '14px' }
const lbl: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#4A5568', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1.5px solid #D1DDD4', borderRadius: '8px', fontSize: '14px', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff', color: '#1A2E22' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
const btnGreen: React.CSSProperties = { background: '#1B3A2D', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const cleanListTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#C0392B', margin: '10px 0 4px' }
const cleanList: React.CSSProperties = { background: '#fff', borderRadius: '6px', border: '1px solid #E7C6C0', maxHeight: '180px', overflowY: 'auto', padding: '4px 0' }
const cleanListRow: React.CSSProperties = { fontSize: '12px', padding: '4px 10px', borderBottom: '1px solid #FDF1EF', color: '#1A2E22' }
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
