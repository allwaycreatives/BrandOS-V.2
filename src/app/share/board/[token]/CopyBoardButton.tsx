'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { copySharedBoard } from './actions'

export default function CopyBoardButton({ token, brands }: { token: string; brands: { id: string; name: string }[] }) {
  const router = useRouter()
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function copy() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await copySharedBoard(token, brandId || undefined)
        if ('error' in res) setError(res.error)
        else router.push(`/brand-spaces/${res.brandSpaceId}/boards/${res.boardId}`)
      } catch {
        setError('Could not copy this board. Please try again.')
      }
    })
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {brands.length > 1 && (
        <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}
      <button type="button" className="primary" onClick={copy} disabled={isPending}>
        {isPending ? 'Copying...' : brands.length === 1 ? `Copy to ${brands[0].name}` : 'Copy to my workspace'}
      </button>
      {error && <span style={{ fontSize: 12.5, color: 'var(--accent)' }}>{error}</span>}
    </div>
  )
}
