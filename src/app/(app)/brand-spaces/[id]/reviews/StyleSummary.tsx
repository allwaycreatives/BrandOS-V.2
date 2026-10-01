'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { generateStyleSummary, saveStyleSummary } from './actions'

export default function StyleSummary({ brandSpaceId, initial, updatedAt }: { brandSpaceId: string; initial: string; updatedAt: string | null }) {
  const router = useRouter()
  const [text, setText] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function rebuild() {
    setMsg(null)
    startTransition(async () => {
      const res = await generateStyleSummary(brandSpaceId)
      if (res.error) setMsg(res.error)
      else if (res.text) {
        setText(res.text)
        setMsg('Rebuilt from all client feedback.')
        router.refresh()
      }
    })
  }
  function save() {
    setMsg(null)
    startTransition(async () => {
      await saveStyleSummary(brandSpaceId, text)
      setMsg('Saved.')
    })
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 4 }}>What this client wants</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Built from every comment and change request. Edit it freely, it is your team&apos;s notes. {updatedAt ? `Last updated ${updatedAt}.` : ''}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        placeholder="Nothing yet. Once the client has given feedback, press Rebuild and we will summarise what they like and keep changing."
        style={{ width: '100%', resize: 'vertical', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="primary" onClick={rebuild} disabled={isPending}>{isPending ? 'Working...' : 'Rebuild from feedback'}</button>
        <button type="button" onClick={save} disabled={isPending}>Save my edits</button>
        {msg && <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{msg}</span>}
      </div>
    </div>
  )
}
