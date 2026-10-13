'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveSocialLinks } from './socialActions'
import { SOCIAL_PLATFORMS, handleOf, type SocialLink } from '@/lib/social'

type Row = { platform: string; input: string }

// A brand's social media links, one tap away. The team can add and change them; everyone else just taps.
export default function SocialLinks({ brandSpaceId, links, canEdit }: { brandSpaceId: string; links: SocialLink[]; canEdit: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function open() {
    setRows(links.length ? links.map((l) => ({ platform: l.platform, input: l.url })) : [{ platform: 'Instagram', input: '' }])
    setError(null)
    setEditing(true)
  }
  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await saveSocialLinks(brandSpaceId, rows)
        if (!res.ok) return setError(res.error || 'Could not save.')
        setEditing(false)
        router.refresh()
      } catch {
        setError('Could not save. Please try again.')
      }
    })
  }
  const setRow = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)))

  if (!editing) {
    if (links.length === 0 && !canEdit) return null
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        {links.map((l) => (
          <a key={`${l.platform}-${l.url}`} href={l.url} target="_blank" rel="noopener noreferrer" title={l.url} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, padding: '5px 12px', border: '1px solid var(--border-strong)', borderRadius: 999, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{l.platform}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{handleOf(l)}</span>
            <span aria-hidden="true" style={{ color: 'var(--text-muted)', fontSize: 11 }}>↗</span>
          </a>
        ))}
        {canEdit && (
          <button type="button" onClick={open} style={{ fontSize: 12.5, padding: '5px 12px', borderRadius: 999 }}>
            {links.length === 0 ? '+ Add social links' : 'Edit links'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="card" style={{ marginTop: 12, maxWidth: 560 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Social links</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>Paste a link, or just the @handle.</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <select value={r.platform} onChange={(e) => setRow(i, { platform: e.target.value })} aria-label="Platform">
            {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input value={r.input} onChange={(e) => setRow(i, { input: e.target.value })} placeholder="@handle or link" aria-label="Link or handle" style={{ flex: '1 1 200px', minWidth: 0 }} />
          <button type="button" onClick={() => setRows((x) => x.filter((_, idx) => idx !== i))} aria-label="Remove" style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Remove</button>
        </div>
      ))}
      {rows.length < 12 && (
        <button type="button" onClick={() => setRows((x) => [...x, { platform: SOCIAL_PLATFORMS.find((p) => !x.some((r) => r.platform === p)) ?? 'Other', input: '' }])} style={{ fontSize: 12.5, marginBottom: 12 }}>Add another</button>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={save} disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={() => setEditing(false)} disabled={isPending}>Cancel</button>
        {error && <span style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>{error}</span>}
      </div>
    </div>
  )
}
