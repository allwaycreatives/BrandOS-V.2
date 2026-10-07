'use client'

import { useState, useTransition } from 'react'
import { enablePlanShare, disablePlanShare, savePlanNote } from './actions'

// The owner's box for sending the plan to a client: the "direction" note, and the no-account link.
export default function PlanShare({ brandSpaceId, brandName, token: initialToken, note: initialNote, waiting }: { brandSpaceId: string; brandName: string; token: string | null; note: string; waiting: number }) {
  const [token, setToken] = useState(initialToken)
  const [note, setNote] = useState(initialNote)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/share/plan/${token}` : ''
  const wa = link ? `https://wa.me/?text=${encodeURIComponent(`Hi! Here is the content plan for ${brandName}. Scroll through it, then comment or approve each post right on the page, no account needed: ${link}`)}` : ''

  function create() {
    startTransition(async () => setToken((await enablePlanShare(brandSpaceId)).token))
  }
  function stop() {
    startTransition(async () => {
      await disablePlanShare(brandSpaceId)
      setToken(null)
      setCopied(false)
    })
  }
  function saveNote() {
    startTransition(async () => {
      await savePlanNote(brandSpaceId, note)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {}
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Share this plan with the client</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        They open a link, scroll the plan week by week, and comment or approve each post. No account, no app. Ideas stay hidden; move a post to Planned to show it.
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>The direction (2–3 sentences: what this plan is about and who it speaks to)</div>
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ width: '100%', marginBottom: 8 }} placeholder="This month we focus on..." />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button type="button" onClick={saveNote} disabled={isPending}>{saved ? 'Saved!' : 'Save the direction'}</button>
      </div>

      {token ? (
        <>
          <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ width: '100%', fontSize: 12, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="primary" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
            <a href={wa} target="_blank" rel="noreferrer"><button type="button">Send on WhatsApp</button></a>
            <a href={link} target="_blank" rel="noreferrer"><button type="button">See what the client sees</button></a>
            <button type="button" onClick={stop} disabled={isPending} style={{ marginLeft: 'auto' }}>Switch off</button>
          </div>
          {waiting > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{waiting} {waiting === 1 ? 'post is' : 'posts are'} waiting for the client&apos;s review.</div>}
        </>
      ) : (
        <button type="button" className="primary" onClick={create} disabled={isPending}>{isPending ? 'Creating link...' : 'Create client link'}</button>
      )}
    </div>
  )
}
