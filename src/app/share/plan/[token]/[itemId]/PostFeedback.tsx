'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitPlanFeedback } from '../actions'

const NAME_KEY = 'brandos-client-name'

// The client's side of one post: approve, ask for changes, or just comment. Remembers their name on this device.
export default function PostFeedback({ token, itemId }: { token: string; itemId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [at, setAt] = useState('')
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) || '')
    } catch {}
  }, [])

  function send(kind: 'comment' | 'changes_requested' | 'approved') {
    setMsg(null)
    const fd = new FormData()
    fd.set('kind', kind)
    fd.set('name', name)
    fd.set('body', body)
    fd.set('at', at)
    startTransition(async () => {
      try {
        const res = await submitPlanFeedback(token, itemId, fd)
        if (!res.ok) return setMsg({ text: res.error || 'Something went wrong.', bad: true })
        try {
          localStorage.setItem(NAME_KEY, name.trim())
        } catch {}
        setBody('')
        setAt('')
        setMsg({ text: kind === 'approved' ? 'Approved. Thank you!' : kind === 'changes_requested' ? 'Sent. The team will make the changes.' : 'Sent. Thank you!', bad: false })
        router.refresh()
      } catch {
        setMsg({ text: 'Could not send. Please try again.', bad: true })
      }
    })
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Your feedback</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" style={{ width: '100%', marginBottom: 8 }} />
      <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a comment or what you would like changed" aria-label="Comment" style={{ width: '100%', marginBottom: 8 }} />
      <input value={at} onChange={(e) => setAt(e.target.value)} placeholder="At what point in the video? (optional, like 0:42)" aria-label="Video time" style={{ width: '100%', marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={() => send('approved')} disabled={isPending}>Approve</button>
        <button type="button" onClick={() => send('changes_requested')} disabled={isPending}>Request changes</button>
        <button type="button" onClick={() => send('comment')} disabled={isPending}>Just comment</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, marginTop: 10, color: msg.bad ? 'var(--accent-text)' : 'var(--text-secondary)' }}>{msg.text}</div>}
    </div>
  )
}
