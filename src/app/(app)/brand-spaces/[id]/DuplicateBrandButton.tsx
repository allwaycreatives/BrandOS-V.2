'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateBrandSpace } from './duplicateBrandAction'

export default function DuplicateBrandButton({ brandSpaceId }: { brandSpaceId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function duplicate() {
    const ok = confirm(
      'Duplicate this brand?\n\nCopied: boards, discovery questions, campaigns (reset to a fresh plan).\nNot copied: people, invites, brand profile, answers, comments and files.'
    )
    if (!ok) return
    startTransition(async () => {
      try {
        const { brandSpaceId: newId } = await duplicateBrandSpace(brandSpaceId)
        router.push(`/brand-spaces/${newId}`)
      } catch {
        alert('Could not duplicate this brand. Please try again.')
      }
    })
  }

  return (
    <button type="button" onClick={duplicate} disabled={isPending}>
      {isPending ? 'Duplicating...' : 'Duplicate brand'}
    </button>
  )
}
