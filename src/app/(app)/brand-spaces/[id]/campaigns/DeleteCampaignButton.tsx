'use client'

import { useTransition } from 'react'
import { deleteCampaign } from './actions'

export default function DeleteCampaignButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm('Delete this campaign? Its content and tasks stay in your calendar and task list.')) return
        startTransition(async () => {
          await deleteCampaign(campaignId)
        })
      }}
      style={{ border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
    >
      {isPending ? 'Deleting...' : 'Delete campaign'}
    </button>
  )
}
