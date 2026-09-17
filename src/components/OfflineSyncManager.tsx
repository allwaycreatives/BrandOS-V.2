'use client'

import { useEffect } from 'react'
import { submitDiscoveryResponse } from '@/app/discovery/[id]/actions'

const DRAFT_PREFIX = 'discovery-draft:'

async function syncPendingDrafts() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(DRAFT_PREFIX)) continue

    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const draft = JSON.parse(raw)
      if (!draft.readyToSync) continue

      const brandSpaceId = key.slice(DRAFT_PREFIX.length)
      await submitDiscoveryResponse(brandSpaceId, {
        ...draft.answers,
        engagement_type: draft.engagementType || 'both',
      })
      localStorage.removeItem(key)
    } catch {
      // Still offline or the request failed — leave it queued, try again
      // next time we're back online.
    }
  }
}

export default function OfflineSyncManager() {
  useEffect(() => {
    if (navigator.onLine) syncPendingDrafts()
    window.addEventListener('online', syncPendingDrafts)
    return () => window.removeEventListener('online', syncPendingDrafts)
  }, [])

  return null
}
