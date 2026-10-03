'use client'

import { useState, useTransition } from 'react'
import { enableBriefLink, disableBriefLink } from './briefActions'

export default function ShareBriefCard({ brandSpaceId, brandName, intakeToken }: { brandSpaceId: string; brandName: string; intakeToken: string | null }) {
  const [token, setToken] = useState(intakeToken)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/brief/${token}` : ''
  const wa = link ? `https://wa.me/?text=${encodeURIComponent(`Hi! To get your project started with ${brandName}, please send us your brief here (takes two minutes, no sign-up): ${link}`)}` : ''

  function create() {
    startTransition(async () => {
      const res = await enableBriefLink(brandSpaceId)
      setToken(res.token)
    })
  }
  function stop() {
    startTransition(async () => {
      await disableBriefLink(brandSpaceId)
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
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Brief link</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
        Clients fill in a short form and a project appears here with their brief attached. No account, nothing to sign up for.
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
        <button type="button" className="primary" onClick={create} disabled={isPending} style={{ width: '100%' }}>{isPending ? 'Creating link...' : 'Create brief link'}</button>
      )}
    </div>
  )
}
