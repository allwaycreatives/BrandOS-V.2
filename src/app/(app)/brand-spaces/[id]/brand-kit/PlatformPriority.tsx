'use client'

import { useState, useTransition } from 'react'
import { setPlatformPriority } from './actions'

export default function PlatformPriority({
  brandSpaceId,
  initialOrder,
}: {
  brandSpaceId: string
  initialOrder: string[]
}) {
  const [order, setOrder] = useState(initialOrder)
  const [isPending, startTransition] = useTransition()

  function move(index: number, direction: -1 | 1) {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
    startTransition(() => setPlatformPriority(brandSpaceId, next))
  }

  const labels = ['Primary', 'Secondary', 'Tertiary']

  return (
    <div className="card" style={{ opacity: isPending ? 0.7 : 1 }}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>Platform priority</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {order.map((platform, i) => (
          <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 70 }}>
              {labels[i] || `#${i + 1}`}
            </span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{platform}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ padding: '4px 10px' }}>
              ↑
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} style={{ padding: '4px 10px' }}>
              ↓
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
