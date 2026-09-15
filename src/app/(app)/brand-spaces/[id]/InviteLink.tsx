'use client'

import { useState } from 'react'

export default function InviteLink({ brandSpaceId }: { brandSpaceId: string }) {
  const [role, setRole] = useState('team_member')
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = `${window.location.origin}/invite/${brandSpaceId}?role=${role}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="team_member">Team member</option>
        <option value="client">Client (view & approve)</option>
      </select>
      <button className="primary" onClick={handleCopy} style={{ width: '100%' }}>
        {copied ? 'Copied!' : 'Copy invite link'}
      </button>
    </div>
  )
}
