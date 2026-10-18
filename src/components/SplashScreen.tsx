'use client'

import { useEffect, useRef, useState } from 'react'

const INTRO_MIN_VISIBLE_MS = 500

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [exiting, setExiting] = useState(false)
  const [mounted, setMounted] = useState(true)
  const startedAt = useRef(Date.now())
  const dismissedRef = useRef(false)

  useEffect(() => {
    function dismiss() {
      if (dismissedRef.current) return
      dismissedRef.current = true
      const elapsed = Date.now() - startedAt.current
      const wait = Math.max(0, INTRO_MIN_VISIBLE_MS - elapsed)
      setTimeout(() => setExiting(true), wait)
    }

    // Dismiss once this component has mounted — for this app, that's
    // effectively "first real render complete."
    dismiss()

    // Guaranteed dismiss: never leave this stuck on screen even if
    // something fails elsewhere in the app.
    window.addEventListener('error', dismiss)
    return () => window.removeEventListener('error', dismiss)
  }, [])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => setMounted(false), 400)
    return () => clearTimeout(timer)
  }, [exiting])

  return (
    <>
      {children}
      {mounted && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'var(--bg-app)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.35s ease',
            opacity: exiting ? 0 : 1,
            pointerEvents: exiting ? 'none' : 'auto',
            // safety net: if the page's scripts never start (e.g. offline), fade away anyway instead of a blank screen
            animation: 'splash-failsafe 0.4s ease 2s forwards',
          }}
        >
          <div className={exiting ? 'app-intro-mark-exit' : 'app-intro-mark'} style={{ width: 96, height: 96 }}>
            <img src="/aw-logo.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </>
  )
}
