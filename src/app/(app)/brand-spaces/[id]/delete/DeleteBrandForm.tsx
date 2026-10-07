'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBrandSpace } from './actions'

export default function DeleteBrandForm({ brandSpaceId, brandName }: { brandSpaceId: string; brandName: string }) {
  const router = useRouter()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const matches = typed.trim() === brandName

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!matches) return
    setError(null)
    startTransition(async () => {
      try {
        const res = await deleteBrandSpace(brandSpaceId, typed)
        if (res.ok) {
          router.refresh()
          router.push('/dashboard')
        } else setError(res.error || 'Could not delete this brand.')
      } catch {
        setError('Could not delete this brand, so nothing was changed. Please try again.')
      }
    })
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, borderColor: 'var(--accent-dim)' }}>
      <label style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        To confirm, type <strong style={{ color: 'var(--text-primary, inherit)' }}>{brandName}</strong> below.
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={brandName}
          autoComplete="off"
          style={{ width: '100%', marginTop: 8 }}
        />
      </label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" type="submit" disabled={!matches || isPending}>
          {isPending ? 'Deleting...' : 'Delete this brand forever'}
        </button>
        <button type="button" onClick={() => router.push(`/brand-spaces/${brandSpaceId}`)} disabled={isPending}>Cancel</button>
        {error && <span style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>{error}</span>}
      </div>
    </form>
  )
}
