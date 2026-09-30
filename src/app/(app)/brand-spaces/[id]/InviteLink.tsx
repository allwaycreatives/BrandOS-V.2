'use client'

import { useState, useTransition } from 'react'
import { createInvite } from './inviteActions'

export default function InviteLink({ brandSpaceId }: { brandSpaceId: string }) {
  const [role, setRole] = useState<'team_member' | 'client'>('team_member')
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    setError(null)
    setCopied(false)
    startTransition(async () => {
      const result = await createInvite(brandSpaceId, role)
      if ('error' in result) {
        setError(result.error)
        return
      }
      const link = `${window.location.origin}/invite/${result.token}`
      setUrl(link)
      try {
        await navigator.clipboard.writeText(link)
        setCopied(true)
      } catch {
        // Some browsers block automatic copying; the link is shown below to copy by hand.
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select
        value={role}
        onChange={(e) => {
          setRole(e.target.value as 'team_member' | 'client')
          setUrl(null)
          setCopied(false)
        }}
      >
        <option value="team_member">Team member</option>
        <option value="client">Client (view & approve)</option>
      </select>
      <button className="primary" onClick={handleCreate} disabled={isPending} style={{ width: '100%' }}>
        {isPending ? 'Creating link...' : copied ? 'Copied!' : 'Copy invite link'}
      </button>
      {url && <input readOnly value={url} onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} />}
      {error && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{error}</div>}
    </div>
  )
}
