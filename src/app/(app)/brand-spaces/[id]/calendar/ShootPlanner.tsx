'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { planProduction } from './actions'
import { PRESETS, type ShootRule } from '@/lib/production'
import { dayLabel } from '@/lib/plan'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Pick how this brand shoots, see what it would do for the month on screen, then apply it.
export default function ShootPlanner({ brandSpaceId, monthKey, monthName }: { brandSpaceId: string; monthKey: string; monthName: string }) {
  const router = useRouter()
  const [preset, setPreset] = useState<ShootRule['preset']>('monthly_one')
  const [d1, setD1] = useState(`${monthKey}-02`)
  const [d2, setD2] = useState(`${monthKey}-16`)
  const [weekday, setWeekday] = useState(1)
  const [lead, setLead] = useState(2)
  const [overwrite, setOverwrite] = useState(false)
  const [result, setResult] = useState<{ perDay: { day: string; count: number }[]; unmatched: number; kept: number } | null>(null)
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  const rule = (): ShootRule => ({
    preset,
    dates: preset === 'monthly_one' ? [d1] : preset === 'monthly_two' ? [d1, d2] : [],
    weekday,
    leadDays: lead,
  })

  function run(apply: boolean) {
    setMsg(null)
    startTransition(async () => {
      try {
        const res = await planProduction(brandSpaceId, monthKey, rule(), overwrite, apply)
        if (!res.ok) return setMsg({ text: res.error || 'Something went wrong.', bad: true })
        setResult({ perDay: res.perDay ?? [], unmatched: res.unmatched ?? 0, kept: res.kept ?? 0 })
        if (apply) {
          setMsg({ text: `Done. ${res.applied} ${res.applied === 1 ? 'post was' : 'posts were'} given a shoot day.`, bad: false })
          router.refresh()
        }
      } catch {
        setMsg({ text: 'Something went wrong. Please try again.', bad: true })
      }
    })
  }

  const label = (t: string) => <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t}</div>
  const help = PRESETS.find((p) => p.key === preset)?.help

  return (
    <details className="card" style={{ marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Plan the shoots for {monthName}</summary>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
          Choose how this brand films its content. Each post is given the right shoot day based on when it goes out. You can still drag any post to a different day afterwards.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ flex: '1 1 220px' }}>
            {label('How do you shoot?')}
            <select style={{ width: '100%' }} value={preset} onChange={(e) => { setPreset(e.target.value as ShootRule['preset']); setResult(null); setMsg(null) }}>
              {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          {(preset === 'monthly_one' || preset === 'monthly_two') && (
            <div style={{ flex: '1 1 150px' }}>
              {label(preset === 'monthly_one' ? 'Shoot day' : 'First shoot day')}
              <input type="date" value={d1} onChange={(e) => setD1(e.target.value)} style={{ width: '100%' }} />
            </div>
          )}
          {preset === 'monthly_two' && (
            <div style={{ flex: '1 1 150px' }}>
              {label('Second shoot day')}
              <input type="date" value={d2} onChange={(e) => setD2(e.target.value)} style={{ width: '100%' }} />
            </div>
          )}
          {preset === 'weekly' && (
            <div style={{ flex: '1 1 150px' }}>
              {label('Shoot day each week')}
              <select style={{ width: '100%' }} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </div>
          )}
          {preset === 'lead' && (
            <div style={{ flex: '1 1 150px' }}>
              {label('Days before posting')}
              <input type="number" min={0} max={60} value={lead} onChange={(e) => setLead(Number(e.target.value) || 0)} style={{ width: '100%' }} />
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{help}</div>

        <label style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setResult(null) }} />
          Also change posts that already have a production date
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => run(false)} disabled={isPending}>{isPending ? 'Working...' : 'See what it would do'}</button>
          {result && (result.perDay.length > 0) && <button type="button" className="primary" onClick={() => run(true)} disabled={isPending}>Apply to {monthName}</button>}
        </div>

        {result && (
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7 }}>
            {result.perDay.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>Nothing to assign. Posts need a publish date in {monthName}.</div>
            ) : (
              result.perDay.map((d) => <div key={d.day}>{dayLabel(d.day)}: {d.count} {d.count === 1 ? 'post' : 'posts'} to film</div>)
            )}
            {result.unmatched > 0 && <div style={{ color: 'var(--accent-text)' }}>{result.unmatched} {result.unmatched === 1 ? 'post goes' : 'posts go'} out before the first shoot day, so {result.unmatched === 1 ? 'it has' : 'they have'} no shoot day. Move the shoot earlier or set those by hand.</div>}
            {result.kept > 0 && <div style={{ color: 'var(--text-muted)' }}>{result.kept} already had a production date and {result.kept === 1 ? 'is' : 'are'} left alone.</div>}
          </div>
        )}
        {msg && <div style={{ fontSize: 12.5, marginTop: 10, color: msg.bad ? 'var(--accent-text)' : 'var(--text-secondary)' }}>{msg.text}</div>}
      </div>
    </details>
  )
}
