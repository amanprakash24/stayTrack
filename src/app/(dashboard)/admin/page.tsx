'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Hotel {
  id: string; name: string; location: string; totalRooms: number;
  managerName?: string | null; active: boolean
}
interface Partner {
  id: string; name: string; location?: string; active: boolean; createdAt: string;
  hotel?: { id: string; name: string; location: string } | null
}

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'hotels' | 'partners'>('hotels')
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [toast, setToast] = useState('')
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null)

  // Add hotel form
  const [hForm, setHForm] = useState({ name: '', location: '', totalRooms: '', managerName: '' })
  // Add partner form
  const [pForm, setPForm] = useState({ name: '', password: '', location: '', hotelId: '' })

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2800) }

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.user || d.user.role !== 'SUPERADMIN') router.push('/bookings')
    })
    loadHotels()
    loadPartners()
  }, [router])

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

  // ── Add hotel ──
  async function addHotel() {
    if (!hForm.name || !hForm.location || !hForm.totalRooms) { showToast('Fill name, location, and rooms'); return }
    const res = await fetch('/api/hotels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hForm),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error ?? 'Error'); return }
    showToast(`Hotel "${data.name}" added!`)
    setHForm({ name: '', location: '', totalRooms: '', managerName: '' })
    loadHotels()
  }

  // ── Save hotel edit ──
  async function saveEdit() {
    if (!editingHotel) return
    if (!editingHotel.name || !editingHotel.location || !editingHotel.totalRooms) {
      showToast('Name, location and rooms are required'); return
    }
    const res = await fetch(`/api/hotels/${editingHotel.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingHotel.name,
        location: editingHotel.location,
        totalRooms: editingHotel.totalRooms,
        managerName: editingHotel.managerName,
      }),
    })
    if (!res.ok) { showToast('Failed to save'); return }
    showToast('Hotel updated!')
    setEditingHotel(null)
    loadHotels()
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
    if (!pForm.name || !pForm.password) { showToast('Name and password required'); return }
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

  return (
    <>
      <div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>Admin Panel</div>
          <div style={{ fontSize: '12px', color: '#718096' }}>Manage hotels & partners</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['hotels', 'partners'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              border: `1.5px solid ${tab === t ? '#1B3A2D' : '#D1DDD4'}`,
              background: tab === t ? '#1B3A2D' : '#fff',
              color: tab === t ? '#fff' : '#4A5568',
            }}>
              {t === 'hotels' ? '🏨 Hotels' : '👥 Partners'}
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
              <div style={group}>
                <label style={lbl}>Manager Name (optional)</label>
                <input style={inp} placeholder="e.g. Ramesh Kumar" value={hForm.managerName} onChange={e => setHForm(f => ({ ...f, managerName: e.target.value }))} />
              </div>
              <button onClick={addHotel} style={btnGreen}>+ Add Hotel</button>
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
                          {h.managerName && ` · 👤 ${h.managerName}`}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#1B3A2D' }}>{p.name}</div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
                        {p.location ? `📍 ${p.location} · ` : ''}
                        <span style={{ color: p.active ? '#1E7E4E' : '#C0392B', fontWeight: 600 }}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                        {' · '}Joined {new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </div>
                      {p.hotel && (
                        <div style={{ fontSize: '12px', color: '#1B3A2D', fontWeight: 600, marginTop: '4px' }}>
                          🏨 {p.hotel.name} · {p.hotel.location}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => togglePartner(p)}
                      style={{ background: p.active ? '#FDECEA' : '#E6F5EC', color: p.active ? '#C0392B' : '#1E7E4E', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}
                    >
                      {p.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: '#1B3A2D', color: '#fff', padding: '10px 20px', borderRadius: '24px', fontSize: '13px', fontWeight: 500, zIndex: 999, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(27,58,45,0.18)' }}>
          {toast}
        </div>
      )}
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
const btnOutline: React.CSSProperties = { background: '#fff', color: '#1B3A2D', border: '1.5px solid #1B3A2D', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
