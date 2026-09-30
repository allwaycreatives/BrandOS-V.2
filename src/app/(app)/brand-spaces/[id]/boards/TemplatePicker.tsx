'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createBoardsFromTemplate } from './actions'

type Item = { key: string; name: string; description: string; boardCount: number }

export default function TemplatePicker({ brandSpaceId, templates }: { brandSpaceId: string; templates: Item[] }) {
  const router = useRouter()
  const [active, setActive] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function use(key: string) {
    setActive(key)
    startTransition(async () => {
      const { boardId } = await createBoardsFromTemplate(brandSpaceId, key)
      const t = templates.find((x) => x.key === key)
      if (t && t.boardCount === 1) router.push(`/brand-spaces/${brandSpaceId}/boards/${boardId}`)
      else router.refresh()
      setActive(null)
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {templates.map((t) => (
        <div key={t.key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 600 }}>{t.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', flex: 1 }}>{t.description}</div>
          <button type="button" onClick={() => use(t.key)} disabled={isPending} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
            {isPending && active === t.key ? 'Adding...' : t.boardCount > 1 ? `Add ${t.boardCount} boards` : 'Use template'}
          </button>
        </div>
      ))}
    </div>
  )
}
