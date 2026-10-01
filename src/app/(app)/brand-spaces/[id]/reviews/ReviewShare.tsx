'use client'

import { useState, useTransition } from 'react'
import { enableReview, disableReview } from './actions'

export default function ReviewShare({ deliverableId, title, token: initial }: { deliverableId: string; title: string; token: string | null }) {
  const [token, setToken] = useState(initial)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/review/${token}` : ''
  const wa = link ? `https://wa.me/?text=${encodeURIComponent(`Hi! Here is "${title}" for your review. You can comment, request changes or approve right on the page, no account needed: ${link}`)}` : ''

  function create() {
    startTransition(async () => {
      const res = await enableReview(deliverableId)
      setToken(res.token)
    })
  }
  function stop() {
    startTransition(async () => {
      await disableReview(deliverableId)
      setToken(null)
      setCopied(false)
    })
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {}
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Send to client</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
        The client opens a link, watches or views the work, and comments or approves. No account, no app.
      </div>
      {token ? (
        <>
          <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ width: '100%', fontSize: 12, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
            <a href={wa} target="_blank" rel="noreferrer"><button type="button">Send on WhatsApp</button></a>
            <button type="button" onClick={stop} disabled={isPending} style={{ marginLeft: 'auto' }}>Switch off</button>
          </div>
        </>
      ) : (
        <button type="button" className="primary" onClick={create} disabled={isPending}>{isPending ? 'Creating link...' : 'Create review link'}</button>
      )}
    </div>
  )
}
