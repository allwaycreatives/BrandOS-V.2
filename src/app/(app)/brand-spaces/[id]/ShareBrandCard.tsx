'use client'

import { useState, useTransition } from 'react'
import { enableBrandShare, disableBrandShare } from './shareActions'

export default function ShareBrandCard({ brandSpaceId, shareToken }: { brandSpaceId: string; shareToken: string | null }) {
  const [token, setToken] = useState(shareToken)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/share/brand/${token}` : ''

  function create() {
    startTransition(async () => {
      const res = await enableBrandShare(brandSpaceId)
      setToken(res.token)
    })
  }

  function stop() {
    startTransition(async () => {
      await disableBrandShare(brandSpaceId)
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
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Share brand guide</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
        A clean, read-only page with the brand&apos;s positioning, voice, audience and platform kit. Anyone with the link can view it, without an account.
      </div>
      {token ? (
        <>
          <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ width: '100%', fontSize: 12, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button type="button" className="primary" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
            <button type="button" onClick={stop} disabled={isPending}>Stop sharing</button>
          </div>
        </>
      ) : (
        <button type="button" className="primary" onClick={create} disabled={isPending} style={{ width: '100%' }}>
          {isPending ? 'Creating link...' : 'Create share link'}
        </button>
      )}
    </div>
  )
}
