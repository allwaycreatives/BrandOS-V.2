'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createFromTemplate, deleteTemplate } from './actions'

export default function UseTemplate({ templateId, brands }: { templateId: string; brands: { id: string; name: string }[] }) {
  const router = useRouter()
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function use() {
    setError(null)
    startTransition(async () => {
      const res = await createFromTemplate(templateId, brandId)
      if (res.href) router.push(res.href)
      else setError(res.error || 'Something went wrong.')
    })
  }
  function remove() {
    if (!confirm('Delete this template? Things you already made from it stay.')) return
    startTransition(async () => {
      await deleteTemplate(templateId)
      router.refresh()
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
      <button type="button" className="primary" onClick={use} disabled={isPending || !brandId}>
        {isPending ? 'Working...' : brands.length === 1 ? `Use for ${brands[0].name}` : 'Use it'}
      </button>
      <button type="button" onClick={remove} disabled={isPending} style={{ marginLeft: 'auto', fontSize: 12 }}>Delete</button>
      {error && <span style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>{error}</span>}
    </div>
  )
}
