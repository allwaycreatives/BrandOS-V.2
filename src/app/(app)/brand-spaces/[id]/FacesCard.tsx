'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addFace, removeFace, startPersonalBrand } from './faceActions'

export type FaceItem = { id: string; name: string; role: string | null; brand: { id: string; color: string } | null }
export type LinkedBrandItem = { id: string; name: string; color: string }

export default function FacesCard({
  brandSpaceId,
  brandName,
  canEdit,
  faces,
  extras,
}: {
  brandSpaceId: string
  brandName: string
  canEdit: boolean
  faces: FaceItem[]
  extras: LinkedBrandItem[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const empty = faces.length === 0 && extras.length === 0

  function run(id: string | null, fn: () => Promise<{ ok: boolean; error?: string; brandSpaceId?: string }>, after?: (r: { brandSpaceId?: string }) => void) {
    setMsg(null)
    setBusyId(id)
    startTransition(async () => {
      try {
        const res = await fn()
        if (res.ok) {
          router.refresh()
          after?.(res)
        } else setMsg(res.error || 'Something went wrong.')
      } catch {
        setMsg('Something went wrong. Please try again.')
      } finally {
        setBusyId(null)
      }
    })
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    run(null, () => addFace(brandSpaceId, name, role), () => {
      setName('')
      setRole('')
    })
  }

  const small: React.CSSProperties = { fontSize: 12, color: 'var(--text-secondary)' }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>The faces of {brandName}</div>
        {(faces.some((f) => f.brand) || extras.length > 0) && (
          <Link href={`/brand-spaces/${brandSpaceId}/family`} style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>Posting map →</Link>
        )}
      </div>
      <div style={{ ...small, marginBottom: 12, lineHeight: 1.5, maxWidth: 560 }}>
        {empty
          ? `The people who represent ${brandName}. Add them now; their personal brands can come later and feed the company.`
          : `The people who represent ${brandName}. A personal brand can come later and feed the company.`}
      </div>

      {!empty && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12, marginBottom: 12 }}>
          {faces.map((f) => (
            <div key={f.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {f.brand && <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.brand.color, flexShrink: 0 }} />}
                <span style={{ fontWeight: 600 }}>{f.name}</span>
              </div>
              {f.role && <div style={small}>{f.role}</div>}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                {f.brand ? (
                  <Link href={`/brand-spaces/${f.brand.id}`} style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>Personal brand →</Link>
                ) : canEdit ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(f.id, () => startPersonalBrand(brandSpaceId, f.id), (r) => r.brandSpaceId && router.push(`/brand-spaces/${r.brandSpaceId}`))}
                    style={{ fontSize: 12.5 }}
                  >
                    {busyId === f.id ? 'Starting...' : 'Start their personal brand'}
                  </button>
                ) : (
                  <span style={small}>No personal brand yet</span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const keeps = f.brand ? `\n\n${f.name}'s personal brand is kept and stays linked under ${brandName}.` : ''
                      if (confirm(`Remove ${f.name} from the faces of ${brandName}?${keeps}`)) run(f.id, () => removeFace(brandSpaceId, f.id))
                    }}
                    style={{ fontSize: 12, background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}

          {extras.map((b) => (
            <Link key={b.id} href={`/brand-spaces/${b.id}`} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color }} />
                <span style={{ fontWeight: 600 }}>{b.name}</span>
              </div>
              <div style={small}>Linked personal brand</div>
            </Link>
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={add} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" style={{ flex: '1 1 140px', minWidth: 0 }} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (optional)" aria-label="Role" style={{ flex: '1 1 140px', minWidth: 0 }} />
          <button type="submit" disabled={isPending || !name.trim()}>{isPending && busyId === null ? 'Adding...' : 'Add a face'}</button>
        </form>
      )}
      {msg && <div style={{ ...small, color: 'var(--accent-text)', marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
