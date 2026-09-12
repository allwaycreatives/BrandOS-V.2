'use client'

import { useState } from 'react'

export default function DiscoveryLink({ brandSpaceId }: { brandSpaceId: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const url = `${window.location.origin}/discovery/${brandSpaceId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button className="primary" onClick={handleCopy} style={{ width: '100%' }}>
      {copied ? 'Copied!' : 'Copy discovery link'}
    </button>
  )
}
