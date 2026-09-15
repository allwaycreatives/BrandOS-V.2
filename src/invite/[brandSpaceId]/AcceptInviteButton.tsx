'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptInvite } from './actions'

export default function AcceptInviteButton({ brandSpaceId, role }: { brandSpaceId: string; role: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAccept() {
    startTransition(async () => {
      await acceptInvite(brandSpaceId, role)
      router.push(`/brand-spaces/${brandSpaceId}`)
    })
  }

  return (
    <button className="primary" onClick={handleAccept} disabled={isPending}>
      {isPending ? 'Joining...' : 'Accept & open'}
    </button>
  )
}
