'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from './actions'

export default function AcceptInviteButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleAccept() {
    setError(null)
    startTransition(async () => {
      const result = await acceptInvite(token)
      if ('error' in result) {
        setError(result.error)
        return
      }
      router.push(`/brand-spaces/${result.brandSpaceId}`)
    })
  }

  return (
    <>
      <button className="primary" onClick={handleAccept} disabled={isPending}>
        {isPending ? 'Joining...' : 'Accept & open'}
      </button>
      {error && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 12 }}>{error}</div>}
    </>
  )
}
