'use client'

import { useEffect, useState } from 'react'

const WARM_KEY = 'brandos-warm-v3-at'
const WARM_EVERY_MS = 10 * 60 * 1000
const ROOTS = ['/dashboard', '/projects', '/tasks', '/campaigns', '/calendar', '/ideas', '/brand-spaces', '/templates']
const PUBLIC_PREFIXES = ['/sign-in', '/sign-up', '/discovery', '/share', '/review', '/brief', '/invite']

function post(msg: Record<string, unknown>) {
  navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage(msg)).catch(() => {})
}

// Registers the offline service worker, pre-loads your pages for offline use,
// sends changes made offline when you're back online, and shows a small status pill.
export default function ServiceWorkerRegister() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [ready, setReady] = useState('')

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    setOnline(navigator.onLine)
    const isPublic = PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p)) || location.pathname === '/'

    navigator.serviceWorker.register('/sw.js').catch(() => {})

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'warmed' && e.data.pages > 0) {
        // only now is it safe to say the pages are saved
        try { localStorage.setItem(WARM_KEY, String(Date.now())) } catch {}
        setReady(`Saved for offline use (${e.data.pages} pages)`)
        setTimeout(() => setReady(''), 6000)
      }
      if (e.data?.type === 'queue') {
        setPending(e.data.count || 0)
        setFailed(e.data.failed || 0)
        if (!e.data.count) setSyncing(false)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = () => {
      // wait a moment so the sign-in session refreshes before we send anything
      clearTimeout(timer)
      timer = setTimeout(() => {
        setSyncing(true)
        post({ type: 'replay' })
        setTimeout(() => post({ type: 'status' }), 4000)
      }, 2500)
    }
    const goOnline = () => { setOnline(true); sync(); warm() }
    const goOffline = () => setOnline(false)

    const warm = () => {
      if (isPublic || !navigator.onLine) return
      let last = 0
      try { last = Number(localStorage.getItem(WARM_KEY) || 0) } catch {}
      if (Date.now() - last < WARM_EVERY_MS) return
      const links = Array.from(document.querySelectorAll('a[href^="/"]'))
        .map((a) => (a as HTMLAnchorElement).getAttribute('href') || '')
        .map((h) => h.split('#')[0].split('?')[0])
      const urls = Array.from(new Set([location.pathname, ...ROOTS, ...links]))
      post({ type: 'warm', urls })
    }

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    post({ type: 'status' })
    if (navigator.onLine) {
      sync()
      const t = setTimeout(warm, 2000)
      return () => {
        clearTimeout(t); clearTimeout(timer)
        window.removeEventListener('online', goOnline)
        window.removeEventListener('offline', goOffline)
        navigator.serviceWorker.removeEventListener('message', onMessage)
      }
    }
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  if (online && !pending && !failed && !ready) return null

  let text = ''
  if (!online) text = pending ? `Offline · ${pending} change${pending === 1 ? '' : 's'} saved, will sync` : 'Offline · changes will sync when you reconnect'
  else if (pending && syncing) text = `Syncing ${pending} change${pending === 1 ? '' : 's'}…`
  else if (pending) text = `${pending} change${pending === 1 ? '' : 's'} waiting to sync`
  else if (failed) text = 'Some changes could not sync'
  else if (ready) text = ready

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        background: online ? '#1f1f1f' : '#b45309', color: '#fff', border: '1px solid rgba(255,255,255,.18)',
        borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600,
        boxShadow: '0 6px 24px rgba(0,0,0,.45)', maxWidth: '92vw', textAlign: 'center',
      }}
    >
      {text}
      {online && pending > 0 && !syncing && (
        <button onClick={() => { setSyncing(true); post({ type: 'replay' }) }} style={{ marginLeft: 10, background: '#fff', color: '#000', border: 0, borderRadius: 999, padding: '3px 10px', fontWeight: 700, cursor: 'pointer' }}>
          Sync now
        </button>
      )}
    </div>
  )
}
