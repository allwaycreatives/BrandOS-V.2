'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitFeedback } from './actions'

const KEY = 'brandos-reviewer-name'

export default function ReviewForm({ token }: { token: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [at, setAt] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => {
    try {
      setName(localStorage.getItem(KEY) || '')
    } catch {}
  }, [])

  async function send(kind: 'comment' | 'changes_requested' | 'approved') {
    setBusy(true)
    setMsg(null)
    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('name', name)
    fd.set('at', at)
    fd.set('body', body)
    try {
      const res = await submitFeedback(token, fd)
      if (!res.ok) {
        setMsg({ text: res.error || 'Something went wrong.', bad: true })
      } else {
        try {
          localStorage.setItem(KEY, name.trim())
        } catch {}
        setBody('')
        setAt('')
        setMsg({ text: kind === 'approved' ? 'Thank you, approved.' : kind === 'changes_requested' ? 'Sent. The team will make the changes.' : 'Comment added.' })
        router.refresh()
      }
    } catch {
      setMsg({ text: 'Could not send. Please try again.', bad: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600 }}>Your feedback</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={{ flex: 1, minWidth: 160 }} />
        <input value={at} onChange={(e) => setAt(e.target.value)} placeholder="Time in video, e.g. 0:42 (optional)" style={{ flex: 1, minWidth: 200 }} />
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="What would you like to say or change?" style={{ width: '100%', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => send('comment')} disabled={busy}>Add comment</button>
        <button type="button" onClick={() => send('changes_requested')} disabled={busy} style={{ borderColor: 'var(--accent)' }}>Request changes</button>
        <button type="button" className="primary" onClick={() => send('approved')} disabled={busy}>Approve</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: msg.bad ? 'var(--accent)' : 'var(--text-secondary)' }}>{msg.text}</div>}
    </div>
  )
}
