'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isDirty, setDirty } from '@/lib/dirtyFlag'

// The post opens as a panel over the calendar, like Notion's peek. Close with the X, Esc, or by clicking outside.
export default function PostModal({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  function close() {
    if (isDirty() && !confirm('You have unsaved changes. Close without saving?')) return
    setDirty(false)
    router.back()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      setDirty(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div role="dialog" aria-modal="true" onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '4vh 12px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 780, maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12 }}>
        <button type="button" onClick={close} aria-label="Close" style={{ position: 'absolute', top: 10, right: 12, zIndex: 2, fontSize: 18, lineHeight: 1, padding: '4px 10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
        <div style={{ padding: '28px 32px 0' }}>{children}</div>
      </div>
    </div>
  )
}
