'use client'

import Link from 'next/link'
import { useState } from 'react'
import { scheduleCalendarItem } from './actions'
import { addDays, dayNumber, mondayOf, todayKey, weekdayShort, weekLabel, CLIENT_STATUS_TEAM } from '@/lib/plan'

export type PlanItem = { id: string; title: string; platform: string; status: string; date: string | null; clientStatus: string }

// A week per row, a day per cell. Drag a post onto a day to schedule it, or back to the tray to unschedule it.
// (Dragging needs a mouse or trackpad. On a phone, open the post and set its date there.)
export default function PlanBoard({ brandSpaceId, initialItems, start, weeks }: { brandSpaceId: string; initialItems: PlanItem[]; start: string; weeks: number }) {
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
    const res = await scheduleCalendarItem(brandSpaceId, id, day)
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

  const post = (i: PlanItem) => (
    <div
      key={i.id}
      className={`plan-post${i.status === 'idea' ? ' is-idea' : ''}`}
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
      <Link href={`/brand-spaces/${brandSpaceId}/calendar/${i.id}`} draggable={false} style={{ display: 'block' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{i.platform}</div>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, margin: '2px 0 4px', overflowWrap: 'anywhere' }}>{i.title}</div>
        <div style={{ fontSize: 11, color: i.clientStatus === 'approved' ? 'var(--accent-text)' : 'var(--text-muted)' }}>
          {i.status === 'idea' ? 'Idea · hidden from client' : CLIENT_STATUS_TEAM[i.clientStatus] ?? i.clientStatus}
        </div>
      </Link>
    </div>
  )

  const unscheduled = items.filter((i) => !i.date)
  const rows = Array.from({ length: weeks }, (_, w) => addDays(mondayOf(start), w * 7))

  return (
    <div>
      <div {...cellProps('tray')} className={`plan-day${overKey === 'tray' ? ' is-over' : ''}`} style={{ marginBottom: 20, minHeight: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Not scheduled yet <span style={{ color: 'var(--text-muted)' }}>({unscheduled.length})</span>
        </div>
        {unscheduled.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Every post has a date. Drag a post here to take its date off.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: 8 }}>{unscheduled.map(post)}</div>
        )}
      </div>

      {msg && <div style={{ fontSize: 12.5, color: 'var(--accent-text)', marginBottom: 10 }}>{msg}</div>}

      {rows.map((monday) => (
        <div key={monday} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Week of {weekLabel(monday)}</div>
          <div className="plan-week">
            {Array.from({ length: 7 }, (_, d) => {
              const key = addDays(monday, d)
              const here = items.filter((i) => i.date === key)
              return (
                <div key={key} {...cellProps(key)} className={`plan-day${overKey === key ? ' is-over' : ''}${key === today ? ' is-today' : ''}${here.length === 0 ? ' is-empty' : ''}`}>
                  <div style={{ fontSize: 11.5, color: key === today ? 'var(--accent-text)' : 'var(--text-muted)', fontWeight: key === today ? 600 : 400 }}>
                    {weekdayShort(key)} {dayNumber(key)}
                  </div>
                  {here.map(post)}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
