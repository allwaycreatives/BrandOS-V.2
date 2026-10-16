'use client'

import { useEffect } from 'react'

// Shown instead of a blank "Application error" screen. Most often this happens right after
// an update, when the open page is from the older version. Reloading fixes it.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <h2 style={{ margin: '0 0 8px' }}>Something went wrong</h2>
        <p style={{ margin: '0 0 18px', opacity: 0.7, fontSize: 14 }}>
          This can happen right after an update, or if you lose your connection mid-action. Reloading usually fixes it.
        </p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 18px', borderRadius: 10, border: 0, fontWeight: 600, cursor: 'pointer' }}>
          Reload
        </button>{' '}
        <button onClick={() => reset()} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,.25)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
          Try again
        </button>
      </div>
    </div>
  )
}
