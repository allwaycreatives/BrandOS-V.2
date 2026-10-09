'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { makeVersion } from '../actions'
import { PLATFORMS } from '../../campaigns/constants'

// One idea, one version per platform. Copies the idea, not the caption or video, because each platform's version
// should be developed for that platform.
export default function MakeVersion({ brandSpaceId, itemId, platform }: { brandSpaceId: string; itemId: string; platform: string }) {
  const router = useRouter()
  const options = PLATFORMS.filter((p) => p !== platform)
  const [target, setTarget] = useState(options[0] ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function go() {
    setMsg(null)
    startTransition(async () => {
      const res = await makeVersion(brandSpaceId, itemId, target)
      if (res.ok && res.itemId) {
        router.push(`/brand-spaces/${brandSpaceId}/calendar/${res.itemId}`)
        router.refresh()
      } else setMsg(res.error || 'Something went wrong.')
    })
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Make a version for another platform</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
        Copies the idea, hook and message into a new post. The caption, script and video start empty, so each platform gets its own version.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Platform">
          {options.map((p) => <option key={p}>{p}</option>)}
        </select>
        <button type="button" onClick={go} disabled={isPending || !target}>{isPending ? 'Making...' : 'Make a version'}</button>
        {msg && <span style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>{msg}</span>}
      </div>
    </div>
  )
}
