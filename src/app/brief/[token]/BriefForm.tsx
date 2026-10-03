'use client'

import { useState } from 'react'
import { submitBrief } from './actions'

const SERIF = "Georgia, 'Times New Roman', serif"
const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', display: 'block' }

export default function BriefForm({ token, brandName }: { token: string; brandName: string }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setBusy(true)
    setError(null)
    try {
      const res = await submitBrief(token, new FormData(form))
      if (res.ok) setDone(true)
      else setError(res.error || 'Something went wrong.')
    } catch {
      setError('Could not send. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="card" style={{ padding: '28px 24px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Thank you, we have your brief</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          The {brandName} team has been notified and will get back to you soon.
        </div>
        <button type="button" onClick={() => setDone(false)}>Send another brief</button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ ...labelStyle, flex: 1, minWidth: 180 }}>
          Your name
          <input name="name" required maxLength={80} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ ...labelStyle, flex: 1, minWidth: 180 }}>
          Email or phone (so we can reply)
          <input name="contact" maxLength={120} style={{ width: '100%', marginTop: 4 }} />
        </label>
      </div>
      <label style={labelStyle}>
        What do you need?
        <input name="title" required maxLength={160} placeholder="e.g. A 60-second launch video" style={{ width: '100%', marginTop: 4 }} />
      </label>
      <label style={labelStyle}>
        Tell us more
        <textarea name="details" rows={5} maxLength={4000} placeholder="What is it for, who is it for, and what should it feel like?" style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
      </label>
      <label style={labelStyle}>
        Links or references (optional)
        <textarea name="references" rows={3} maxLength={2000} placeholder="Paste links to examples you like, files, or your brand guidelines" style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
      </label>
      <label style={{ ...labelStyle, maxWidth: 220 }}>
        When do you need it? (optional)
        <input type="date" name="deadline" style={{ width: '100%', marginTop: 4 }} />
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0 }} />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Send brief'}</button>
        {error && <span style={{ fontSize: 12.5, color: 'var(--accent)' }}>{error}</span>}
      </div>
    </form>
  )
}
