'use client'
import { useEffect, useState } from 'react'

const TOAST_EVENT = 'staytrack-toast'

export function showToast(msg: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: msg }))
  }
}

export default function Toaster() {
  const [toast, setToast] = useState('')

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const handler = (e: Event) => {
      setToast((e as CustomEvent<string>).detail)
      clearTimeout(timer)
      timer = setTimeout(() => setToast(''), 2800)
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => { window.removeEventListener(TOAST_EVENT, handler); clearTimeout(timer) }
  }, [])

  if (!toast) return null
  return (
    <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', background: '#1B3A2D', color: '#fff', padding: '10px 20px', borderRadius: '24px', fontSize: '13px', fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(27,58,45,0.18)' }}>
      {toast}
    </div>
  )
}
