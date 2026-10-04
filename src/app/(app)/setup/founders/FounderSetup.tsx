'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createFounderBrands } from './actions'

export default function FounderSetup() {
  const router = useRouter()
  const [shared, setShared] = useState('')
  const [founders, setFounders] = useState(['', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setFounder = (i: number, v: string) => setFounders((f) => f.map((x, idx) => (idx === i ? v : x)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await createFounderBrands(shared, founders)
      if (res.brandSpaceId) {
        router.refresh()
        router.push(`/brand-spaces/${res.brandSpaceId}`)
      } else setError(res.error || 'Something went wrong.')
    } catch {
      setError('Could not create these. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const label: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      <label style={label}>
        Shared brand name
        <input value={shared} onChange={(e) => setShared(e.target.value)} placeholder="The name of what they build together" required style={{ width: '100%', marginTop: 4 }} />
      </label>

      <div>
        <div style={label}>Founders</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {founders.map((f, i) => (
            <input key={i} value={f} onChange={(e) => setFounder(i, e.target.value)} placeholder={`Founder ${i + 1} name`} style={{ width: '100%' }} />
          ))}
        </div>
        {founders.length < 5 && (
          <button type="button" onClick={() => setFounders((f) => [...f, ''])} style={{ marginTop: 8, fontSize: 12.5 }}>Add another founder</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Setting up...' : 'Set it up'}</button>
        {error && <span style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>{error}</span>}
      </div>
    </form>
  )
}
