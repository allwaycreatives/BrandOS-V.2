import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { createCalendarItem } from './actions'
import CalendarCard from './CalendarCard'
import { PLATFORMS } from '../campaigns/constants'

const COLUMNS = [
  { key: 'idea', label: 'Idea' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In Production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

export default async function CalendarPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace } = access

  const items = await db.calendarItem
    .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } })
    .catch(() => [])

  const createWithId = createCalendarItem.bind(null, params.id)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="topbar-greeting">Calendar</div>
          <div className="topbar-sub">Plan content and move it through production.</div>
        </div>
        <form action={createWithId} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="title" required placeholder="Content title" style={{ flex: '1 1 200px' }} />
          <select name="platform" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button className="primary" type="submit">Add</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(min(100%, 180px), 1fr))', gap: 12, overflowX: 'auto' }}>
        {COLUMNS.map((col, colIndex) => {
          const colItems = items.filter((i) => i.status === col.key)
          return (
            <div key={col.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, minHeight: 140 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {col.label} <span style={{ color: 'var(--text-muted)' }}>({colItems.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
                {colItems.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing here</div>}
                {colItems.map((item) => (
                  <CalendarCard
                    key={item.id}
                    brandSpaceId={params.id}
                    itemId={item.id}
                    title={item.title}
                    platform={item.platform}
                    canMoveBack={colIndex > 0}
                    canMoveForward={colIndex < COLUMNS.length - 1}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
