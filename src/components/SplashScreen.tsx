'use client'

import { useEffect, useState } from 'react'

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!fading) return
    const timer = setTimeout(() => setVisible(false), 400)
    return () => clearTimeout(timer)
  }, [fading])

  return (
    <>
      {children}
      {visible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            textAlign: 'center',
            padding: '0 1.5rem',
            background: 'radial-gradient(circle at 50% 42%, #17130f 0%, #0a0a0a 72%)',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.4s ease',
          }}
        >
          <div className="logo-glow-wrap splash-drop">
            <img src="/aw-logo.png" alt="All Way Creatives" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          </div>
          <img
            src="/brandos-logo.png"
            alt="BrandOS"
            style={{ height: 44 }}
            className="splash-drop splash-drop-delay-1"
          />
          <p
            style={{ color: 'var(--text-secondary)', maxWidth: 380, marginTop: -4 }}
            className="splash-drop splash-drop-delay-2"
          >
            The operating system for creators, brands, and the agencies serving them.
          </p>
          <div
            className="splash-drop splash-drop-delay-3"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}
          >
            <span className="badge">Your brand is waiting to be built</span>
            <button className="primary" onClick={() => setFading(true)}>
              Enter BrandOS
            </button>
          </div>
        </div>
      )}
    </>
  )
}
