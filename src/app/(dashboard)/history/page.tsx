'use client'
import { useEffect, useState } from 'react'

interface Log {
  id: string; action: string; createdAt: string;
  user: { name: string; role: string };
  bookingId?: string;
}

const AVATAR_COLORS = ['#1B3A2D','#7B2D8B','#C9A84C','#C0392B','#2196F3','#E67E22','#16A085']

function colorFor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/history').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setLogs(d)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '22px', color: '#1B3A2D', fontWeight: 800 }}>Edit History</div>
        <div style={{ fontSize: '12px', color: '#718096' }}>All partner actions · Full audit trail</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#718096', padding: '40px' }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#718096', padding: '40px' }}>No history yet</div>
      ) : logs.map(log => (
        <div key={log.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #D1DDD4', padding: '14px 16px', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start', boxShadow: '0 2px 12px rgba(27,58,45,0.08)' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: colorFor(log.user.name), color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, flexShrink: 0,
          }}>
            {initials(log.user.name)}
          </div>
          <div>
            <div style={{ fontSize: '13px', color: '#1A2E22' }}>
              <strong style={{ color: '#1B3A2D' }}>{log.user.name}</strong>
              {log.user.role === 'SUPERADMIN' && <span style={{ fontSize: '10px', background: '#EAF0EC', color: '#1B3A2D', borderRadius: '4px', padding: '1px 6px', marginLeft: '6px', fontWeight: 600 }}>ADMIN</span>}
              {' · '}{log.action}
            </div>
            <div style={{ fontSize: '11px', color: '#718096', marginTop: '3px' }}>
              🕐 {new Date(log.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
