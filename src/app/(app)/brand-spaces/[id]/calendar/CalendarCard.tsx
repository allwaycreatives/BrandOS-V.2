'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { moveCalendarItem } from './actions'

export default function CalendarCard({
  brandSpaceId,
  itemId,
  title,
  platform,
  canMoveBack,
  canMoveForward,
}: {
  brandSpaceId: string
  itemId: string
  title: string
  platform: string
  canMoveBack: boolean
  canMoveForward: boolean
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="card" style={{ opacity: isPending ? 0.6 : 1 }}>
      <Link href={`/brand-spaces/${brandSpaceId}/calendar/${itemId}`}>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 10 }}>{platform}</div>
      </Link>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          disabled={!canMoveBack || isPending}
          onClick={() => startTransition(() => moveCalendarItem(brandSpaceId, itemId, -1))}
          style={{ padding: '3px 9px', fontSize: 12 }}
        >
          ←
        </button>
        <button
          type="button"
          disabled={!canMoveForward || isPending}
          onClick={() => startTransition(() => moveCalendarItem(brandSpaceId, itemId, 1))}
          style={{ padding: '3px 9px', fontSize: 12 }}
        >
          →
        </button>
      </div>
    </div>
  )
}
