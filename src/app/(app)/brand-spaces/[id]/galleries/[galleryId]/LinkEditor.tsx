'use client'

import { useEffect, useState, useTransition } from 'react'
import { setGallerySlug } from '../actions'
import { slugify } from '@/lib/galleryFormat'

// Lets the photographer give the gallery a readable link, like /gallery/spelling-bee-2026.
export default function LinkEditor({ galleryId, slug, suggestFrom, hasPasscode }: { galleryId: string; slug: string | null; suggestFrom: string; hasPasscode: boolean }) {
  const [value, setValue] = useState(slug ?? '')
  const [origin, setOrigin] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  useEffect(() => setOrigin(window.location.origin.replace(/^https?:\/\//, '')), [])

  const save = (next: string) =>
    start(async () => {
      setMsg(null)
      const r = await setGallerySlug(galleryId, next)
      if ('error' in r) setMsg({ ok: false, text: r.error })
      else {
        setValue(r.slug ?? '')
        setMsg({ ok: true, text: r.slug ? 'Saved. This is now the link to share. The original private link still works too.' : 'Back to the private link.' })
      }
    })

  const suggest = () => {
    const rand = Math.random().toString(36).slice(2, 6)
    setValue(`${slugify(suggestFrom) || 'gallery'}-${rand}`)
    setMsg(null)
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Make the link easy to read</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>For example {origin || 'your-site'}/gallery/<strong>spelling-bee-2026</strong></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{origin ? `${origin}/gallery/` : '/gallery/'}</span>
        <input value={value} onChange={(e) => { setValue(e.target.value.toLowerCase().replace(/\s+/g, '-')); setMsg(null) }} placeholder="spelling-bee-2026" style={{ flex: 1, minWidth: 180 }} aria-label="Gallery link" />
        <button type="button" onClick={suggest} disabled={pending}>Suggest</button>
        <button type="button" className="primary" onClick={() => save(value)} disabled={pending}>{pending ? '…' : 'Save link'}</button>
        {slug && <button type="button" onClick={() => save('')} disabled={pending} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12 }}>Use the private link</button>}
      </div>
      {msg && <div style={{ fontSize: 12.5, marginTop: 8, color: msg.ok ? 'var(--accent-text)' : '#c0392b' }}>{msg.text}</div>}
      {!hasPasscode && <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>A readable link is easier to guess than a random one. For a private gallery, add a passcode below.</div>}
    </div>
  )
}
