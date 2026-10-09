'use client'

import { useState, useTransition } from 'react'
import { saveStrategy } from './actions'
import { PLATFORMS } from '../campaigns/constants'
import type { Strategy, Pillar, PlatformRole, Series } from '@/lib/strategy'

const ROLES: { key: PlatformRole['role']; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'supporting', label: 'Supporting' },
]

export default function StrategyForm({ brandSpaceId, initial }: { brandSpaceId: string; initial: Strategy }) {
  const [s, setS] = useState<Strategy>(initial)
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)

  const upd = <K extends keyof Strategy>(key: K, v: Strategy[K]) => setS((x) => ({ ...x, [key]: v }))
  const setRow = <T,>(key: 'pillars' | 'platforms' | 'series', i: number, patch: Partial<T>) =>
    setS((x) => ({ ...x, [key]: (x[key] as unknown as T[]).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }))
  const removeRow = (key: 'pillars' | 'platforms' | 'series', i: number) => setS((x) => ({ ...x, [key]: (x[key] as unknown[]).filter((_, idx) => idx !== i) } as Strategy))

  function save() {
    setMsg(null)
    startTransition(async () => {
      try {
        const res = await saveStrategy(brandSpaceId, s)
        setMsg(res.ok ? { text: 'Saved.', bad: false } : { text: res.error || 'Could not save.', bad: true })
      } catch {
        setMsg({ text: 'Could not save. Please try again.', bad: true })
      }
    })
  }

  const label = (t: string, hint?: string) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
  const heading = (t: string, hint: string) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontWeight: 600 }}>{t}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{hint}</div>
    </div>
  )
  const addBtn = (text: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{ fontSize: 12.5 }}>{text}</button>
  )
  const rowBox: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }
  const xBtn = (onClick: () => void) => (
    <button type="button" onClick={onClick} aria-label="Remove" style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Remove</button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        {heading('Mission and season', 'Why this brand makes content, and the story of the current season.')}
        {label('Mission', 'One or two sentences.')}
        <textarea rows={2} value={s.mission} onChange={(e) => upd('mission', e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
        {label('Season name', 'For example: Starting From Where I Am')}
        <input value={s.seasonName} onChange={(e) => upd('seasonName', e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
        {label('Season story')}
        <textarea rows={4} value={s.seasonStory} onChange={(e) => upd('seasonStory', e.target.value)} style={{ width: '100%' }} />
      </div>

      <div className="card">
        {heading('Content pillars', 'The few themes everything should fit under. Mark the core one; the rest support it.')}
        {s.pillars.map((p, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={rowBox}>
              <input value={p.name} onChange={(e) => setRow<Pillar>('pillars', i, { name: e.target.value })} placeholder="Pillar name" style={{ flex: '1 1 200px' }} />
              <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={p.core} onChange={(e) => setRow<Pillar>('pillars', i, { core: e.target.checked })} /> Core pillar
              </label>
              {xBtn(() => removeRow('pillars', i))}
            </div>
            <input value={p.line} onChange={(e) => setRow<Pillar>('pillars', i, { line: e.target.value })} placeholder="In one line: what this pillar covers" style={{ width: '100%' }} />
          </div>
        ))}
        {s.pillars.length < 12 && addBtn('Add a pillar', () => upd('pillars', [...s.pillars, { name: '', line: '', core: s.pillars.length === 0 }]))}
      </div>

      <div className="card">
        {heading('Platforms', 'What each platform is for, and how often to post there. Targets drive the weekly check on the calendar.')}
        {s.platforms.map((p, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={rowBox}>
              <select value={p.name} onChange={(e) => setRow<PlatformRole>('platforms', i, { name: e.target.value })} aria-label="Platform">
                {Array.from(new Set([...PLATFORMS, p.name].filter(Boolean))).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <select value={p.role} onChange={(e) => setRow<PlatformRole>('platforms', i, { role: e.target.value as PlatformRole['role'] })} aria-label="Role">
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
              <label style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
                Posts per week
                <input type="number" min={0} max={50} step={0.25} value={p.perWeek} onChange={(e) => setRow<PlatformRole>('platforms', i, { perWeek: Number(e.target.value) || 0 })} style={{ width: 70 }} />
              </label>
              {xBtn(() => removeRow('platforms', i))}
            </div>
            <input value={p.expression} onChange={(e) => setRow<PlatformRole>('platforms', i, { expression: e.target.value })} placeholder="The platform's angle, for example: Come watch the journey" style={{ width: '100%' }} />
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>Twice a month is 0.5 per week.</div>
        {s.platforms.length < 12 && addBtn('Add a platform', () => upd('platforms', [...s.platforms, { name: PLATFORMS.find((n) => !s.platforms.some((p) => p.name === n)) || PLATFORMS[0], role: s.platforms.length === 0 ? 'primary' : 'supporting', perWeek: 1, expression: '' }]))}
      </div>

      <div className="card">
        {heading('Series', 'Named, repeatable formats. Each belongs to a pillar.')}
        {s.series.map((p, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={rowBox}>
              <input value={p.name} onChange={(e) => setRow<Series>('series', i, { name: e.target.value })} placeholder="Series name" style={{ flex: '1 1 200px' }} />
              <select value={p.pillar} onChange={(e) => setRow<Series>('series', i, { pillar: e.target.value })} aria-label="Pillar">
                <option value="">No pillar</option>
                {s.pillars.filter((x) => x.name.trim()).map((x) => (
                  <option key={x.name} value={x.name}>{x.name}</option>
                ))}
              </select>
              {xBtn(() => removeRow('series', i))}
            </div>
            <input value={p.line} onChange={(e) => setRow<Series>('series', i, { line: e.target.value })} placeholder="What a post in this series is" style={{ width: '100%' }} />
          </div>
        ))}
        {s.series.length < 40 && addBtn('Add a series', () => upd('series', [...s.series, { name: '', pillar: '', line: '' }]))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="primary" type="button" onClick={save} disabled={isPending}>{isPending ? 'Saving...' : 'Save strategy'}</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.bad ? 'var(--accent-text)' : 'var(--text-secondary)' }}>{msg.text}</span>}
      </div>
    </div>
  )
}
