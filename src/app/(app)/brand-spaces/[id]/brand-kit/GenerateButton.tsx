'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateBrandKit } from './actions'

export default function GenerateButton({ brandSpaceId }: { brandSpaceId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      await generateBrandKit(brandSpaceId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button className="primary" onClick={handleClick} disabled={loading}>
        {loading ? 'Generating...' : 'Generate options'}
      </button>
      {error && (
        <div style={{ color: '#e5484d', fontSize: 12.5, marginTop: 10, maxWidth: 480 }}>{error}</div>
      )}
    </div>
  )
}
