'use client'

import { useTransition } from 'react'
import { deleteDeliverable } from './actions'

export default function DeleteDeliverableButton({ deliverableId }: { deliverableId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm('Delete this deliverable and all its feedback? This cannot be undone.')) return
        startTransition(async () => {
          await deleteDeliverable(deliverableId)
        })
      }}
      style={{ border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
    >
      {isPending ? 'Deleting...' : 'Delete deliverable'}
    </button>
  )
}
