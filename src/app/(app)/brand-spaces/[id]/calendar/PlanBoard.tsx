'use client'

import Link from 'next/link'
import { useState } from 'react'
import { scheduleCalendarItem } from './actions'
import { addDays, gridDayLabel, mondayOf, monthKeyOf, todayKey, weekdayShort, weekLabel } from '@/lib/plan'

export type PlanItem = { id: string; title: string; platform: string; status: string; date: string | null; clientStatus: string; pillar: string | null; priority: string; time?: string | null }
export type PlatformTarget = { name: string; perWeek: number }

const DocIcon = ({ accent }: { accent?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={accent ? 'var(--accent-text)' : 'currentColor'} strokeWidth="1.4" style={{ flexShrink: 0, opacity: accent ? 1 : 0.6 }} aria-hidden="true">
    <path d="M4 1.7h5.2L12.3 5v9.3H4z" strokeLinejoin="round" />
    <path d="M9 1.8V5h3.2M6 8h4.3M6 10.6h4.3" strokeLinecap="round" />
  </svg>
)

// A month, one week per row. Each post is a small chip: click it to open the post as a panel over the calendar.
// Drag a chip onto a day to schedule it, or onto "No date" to take its date off. (Dragging needs a mouse or trackpad;
// on a phone, open the post and set its date there.)
export default function PlanBoard({
  brandSpaceId,
  initialItems,
  start,
  weeks,
  monthKey,
  dateField = 'publish',
  targets = [],
}: {
  brandSpaceId: string
  initialItems: PlanItem[]
  start: string
  weeks: number
  monthKey: string
  dateField?: 'publish' | 'production'
  targets?: PlatformTarget[]
}) {
  const [items, setItems] = useState(initialItems)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const today = todayKey()

  async function drop(day: string | null) {
    const id = dragId
    setDragId(null)
    setOverKey(null)
    if (!id) return
    const before = items.find((i) => i.id === id)
    if (!before || before.date === day) return
    setMsg(null)
    setItems((all) => all.map((i) => (i.id === id ? { ...i, date: day } : i)))
    const res = await scheduleCalendarItem(brandSpaceId, id, day, dateField)
    if (!res.ok) {
      setItems((all) => all.map((i) => (i.id === id ? { ...i, date: before.date } : i)))
      setMsg(res.error || 'Could not move this post.')
    }
  }

  const cellProps = (key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragId) return
      e.preventDefault()
      setOverKey(key)
    },
    onDragLeave: () => setOverKey((k) => (k === key ? null : k)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      drop(key === 'tray' ? null : key)
    },
  })

  const chip = (i: PlanItem) => (
    <div
      key={i.id}
      className={`plan-chip${i.status === 'idea' ? ' is-idea' : ''}`}
      title={`${i.title} · ${i.platform}${i.status === 'idea' ? ' · Idea, hidden from the client' : ''}`}
      draggable
      onDragStart={(e) => {
        setDragId(i.id)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', i.id)
      }}
      onDragEnd={() => {
        setDragId(null)
        setOverKey(null)
      }}
    >
      <Link href={`/brand-spaces/${brandSpaceId}/calendar/${i.id}`} draggable={false}>
        <DocIcon accent={i.priority === 'high'} />
        <span className="t">{dateField === 'publish' && i.time ? `${i.time} · ` : ''}{i.title || 'Untitled'}</span>
      </Link>
      {i.clientStatus === 'approved' && i.status !== 'idea' && <span style={{ fontSize: 11, color: 'var(--accent-text)' }} aria-label="Approved">✓</span>}
      {i.clientStatus === 'changes_requested' && i.status !== 'idea' && <span style={{ fontSize: 11, color: 'var(--accent-text)' }} aria-label="Changes requested">↺</span>}
    </div>
  )

  const unscheduled = items.filter((i) => !i.date)
  const rows = Array.from({ length: weeks }, (_, w) => addDays(mondayOf(start), w * 7))

  return (
    <div>
      <div {...cellProps('tray')} className={`plan-day${overKey === 'tray' ? ' is-over' : ''}`} style={{ marginBottom: 16, minHeight: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {dateField === 'production' ? 'No production date' : 'No date'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({unscheduled.length})</span>
        </div>
        {unscheduled.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Every post has a date. Drag a post here to take its date off.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: 6 }}>{unscheduled.map(chip)}</div>
        )}
      </div>

      {msg && <div style={{ fontSize: 12.5, color: 'var(--accent-text)', marginBottom: 10 }}>{msg}</div>}

      <div className="plan-weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, d) => (
          <div key={d}>{weekdayShort(addDays(mondayOf(start), d))}</div>
        ))}
      </div>

      {rows.map((monday) => (
        <div key={monday} style={{ marginBottom: 8 }}>
          {targets.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-muted)', margin: '6px 2px 4px' }}>
              <span>Week of {weekLabel(monday)}</span>
              {targets.map((t) => {
                const end = addDays(monday, 6)
                const planned = items.filter((i) => i.platform === t.name && i.status !== 'idea' && i.date && i.date >= monday && i.date <= end).length
                const short = t.perWeek >= 1 && planned < t.perWeek
                return (
                  <span key={t.name} style={{ color: short ? 'var(--accent-text)' : undefined }}>
                    {t.name} {planned} of {t.perWeek}
                  </span>
                )
              })}
            </div>
          )}
          <div className="plan-week">
            {Array.from({ length: 7 }, (_, d) => {
              const key = addDays(monday, d)
              const here = items.filter((i) => i.date === key)
              const outside = monthKeyOf(key) !== monthKey
              return (
                <div key={key} {...cellProps(key)} className={`plan-day${overKey === key ? ' is-over' : ''}${key === today ? ' is-today' : ''}${here.length === 0 ? ' is-empty' : ''}${outside ? ' is-outside' : ''}`}>
                  <div className="plan-dhead">
                    <span className="plan-dwk">{weekdayShort(key)}</span>
                    <span className={`plan-dnum${key === today ? ' is-today' : ''}`}>{gridDayLabel(key)}</span>
                  </div>
                  {here.map(chip)}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
