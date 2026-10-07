'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createFounderBrands, type FounderSetupMode } from './actions'

const SERIF = "Georgia, 'Times New Roman', serif"

const MODES: { value: FounderSetupMode; title: string; text: string }[] = [
  { value: 'company', title: 'Company first', text: 'Recommended. Just the company brand. Founders are listed as its faces, and each can get a personal brand later.' },
  { value: 'both', title: 'Company + personal brands now', text: 'The company brand and a linked personal brand for each founder, ready from day one.' },
]

export default function FounderSetup() {
  const router = useRouter()
  const [mode, setMode] = useState<FounderSetupMode>('company')
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
      const res = await createFounderBrands(shared, founders, mode)
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
    <>
      <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
        <div>
          <div style={label}>How do you want to start?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup" aria-label="How to start">
            {MODES.map((m) => {
              const on = mode === m.value
              return (
                <label
                  key={m.value}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `1px solid ${on ? 'var(--accent-dim)' : 'var(--border-strong)'}`,
                  }}
                >
                  <input type="radio" name="mode" value={m.value} checked={on} onChange={() => setMode(m.value)} style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 13.5 }}>{m.title}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.text}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <label style={label}>
          Company brand name
          <input value={shared} onChange={(e) => setShared(e.target.value)} placeholder="The name of what they build together" required style={{ width: '100%', marginTop: 4 }} />
        </label>

        <div>
          <div style={label}>{mode === 'company' ? 'The faces (founders)' : 'Founders'}</div>
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

      <div className="card" style={{ maxWidth: 560, marginTop: 24 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>What gets created</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div><strong>The company brand</strong> starts with a Brand architecture board (decide what is shared and what is personal, platform by platform) and the Brand bible.</div>
          {mode === 'company' ? (
            <div><strong>The faces</strong> are listed on the company page. When a founder is ready, press &quot;Start their personal brand&quot; next to their name.</div>
          ) : (
            <div><strong>Each founder&apos;s brand</strong> starts with a Founder profile board: story, voice, platforms and content angles. They are also listed as faces of the company.</div>
          )}
          <div><strong>A first task</strong> on the company brand to decide who shows up where.</div>
        </div>
      </div>
    </>
  )
}
