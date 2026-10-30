'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// The first time someone opens Brand Console in a browser session they get the full animated welcome.
// Later opens in the same session (reloads) get a quick, calm version.
const FIRST_VISIBLE_MS = 3000
const QUICK_VISIBLE_MS = 650

// Pages other people see (clients, visitors, sign-in) never get the welcome: they are about the client's work, not ours.
const NO_SPLASH = ['/gallery', '/review', '/share', '/brief', '/discovery', '/invite', '/privacy', '/terms', '/sign-in', '/sign-up']

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const path = usePathname() || ''
  const skip = path === '/' || NO_SPLASH.some((p) => path === p || path.startsWith(p + '/'))
  const [exiting, setExiting] = useState(false)
  const [mounted, setMounted] = useState(true)
  const startedAt = useRef(Date.now())
  const dismissedRef = useRef(false)

  useEffect(() => {
    function dismiss() {
      if (dismissedRef.current) return
      dismissedRef.current = true
      const quick = document.documentElement.getAttribute('data-intro') === 'seen'
      const wait = Math.max(0, (quick ? QUICK_VISIBLE_MS : FIRST_VISIBLE_MS) - (Date.now() - startedAt.current))
      setTimeout(() => {
        setExiting(true)
        try {
          sessionStorage.setItem('bc-intro', '1')
        } catch {}
      }, wait)
    }

    // The app has started once this component is on screen.
    dismiss()

    // Never leave this stuck on screen even if something fails elsewhere in the app.
    window.addEventListener('error', dismiss)
    return () => window.removeEventListener('error', dismiss)
  }, [])

  useEffect(() => {
    if (!exiting) return
    const timer = setTimeout(() => setMounted(false), 500)
    return () => clearTimeout(timer)
  }, [exiting])

  return (
    <>
      {children}
      {mounted && !skip && (
        <div aria-hidden="true" className={`bc-splash${exiting ? ' exit' : ''}`}>
          <div className="bc-splash-mark">
            <img className="bc-s-brand" src="/brand/full-b.png" alt="" draggable={false} />
            <img className="bc-s-console bc-s-dark" src="/brand/full-c-onDark.png" alt="" draggable={false} />
            <img className="bc-s-console bc-s-light" src="/brand/full-c-onLight.png" alt="" draggable={false} />
          </div>
          <div className="bc-s-by">
            <span>by</span>
            <img src="/aw-logo.png" alt="" draggable={false} />
            <span>All Way Creatives</span>
          </div>
        </div>
      )}
    </>
  )
}
