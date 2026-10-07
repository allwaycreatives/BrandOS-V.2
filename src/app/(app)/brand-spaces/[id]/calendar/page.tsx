import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { createCalendarItem } from './actions'
import CalendarCard from './CalendarCard'
import PlanBoard, { type PlanItem } from './PlanBoard'
import PlanShare from './PlanShare'
import { PLATFORMS } from '../campaigns/constants'
import { addDays, dayKey, dayLabel, mondayOf, todayKey, visibleToClient, weekLabel } from '@/lib/plan'

const COLUMNS = [
  { key: 'idea', label: 'Idea' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In Production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

const WEEKS = 4

export default async function CalendarPage({ params, searchParams }: { params: { id: string }; searchParams: { view?: string; w?: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace } = access
  const isClient = access.role === 'client'
  const board = searchParams.view === 'board'

  const items = await db.calendarItem
    .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } })
    .catch(() => [])

  const createWithId = createCalendarItem.bind(null, params.id)
  const base = `/brand-spaces/${params.id}/calendar`

  const tab = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
  })

  // Plan view data
  const wParam = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.w || '') ? (searchParams.w as string) : todayKey()
  const start = mondayOf(wParam)
  const planItems: PlanItem[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    platform: i.platform,
    status: i.status,
    date: i.scheduledDate ? dayKey(i.scheduledDate) : null,
    clientStatus: i.clientStatus,
  }))
  // Dated posts outside the four weeks on screen are not lost: say so, and let the owner step to them.
  const hiddenEarlier = planItems.filter((i) => i.date && i.date < start).length
  const hiddenLater = planItems.filter((i) => i.date && i.date >= addDays(start, WEEKS * 7)).length
  const waiting = items.filter((i) => visibleToClient(i.status) && i.clientStatus === 'pending').length
  const visibleStart = planItems.filter((i) => !i.date || (i.date >= start && i.date < addDays(start, WEEKS * 7)))

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="topbar-greeting">Calendar</div>
          <div className="topbar-sub">{board ? 'Move content through production.' : 'Plan content by day. Drag a post to a new date.'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={base} style={tab(!board)}>Plan</Link>
          <Link href={`${base}?view=board`} style={tab(board)}>Production board</Link>
        </div>
      </div>

      {!isClient && (
        <form action={createWithId} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <input name="title" required placeholder="Content title" style={{ flex: '1 1 200px' }} />
          <select name="platform" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          {!board && <input type="date" name="date" aria-label="Date (optional)" />}
          {/* On the plan, a new post starts as Planned so the client can see it; on the board it starts as an Idea. */}
          <input type="hidden" name="status" value={board ? 'idea' : 'planned'} />
          <button className="primary" type="submit">Add</button>
        </form>
      )}

      {board ? (
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
                      date={item.scheduledDate ? dayLabel(dayKey(item.scheduledDate)) : undefined}
                      canMoveBack={!isClient && colIndex > 0}
                      canMoveForward={!isClient && colIndex < COLUMNS.length - 1}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {!isClient && <PlanShare brandSpaceId={params.id} brandName={brandSpace!.name} token={brandSpace!.planToken} note={brandSpace!.planNote || ''} waiting={waiting} />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Link href={`${base}?w=${addDays(start, -WEEKS * 7)}`} style={tab(false)}>← Earlier</Link>
            <Link href={base} style={tab(false)}>This week</Link>
            <Link href={`${base}?w=${addDays(start, WEEKS * 7)}`} style={tab(false)}>Later →</Link>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{weekLabel(start)} and the next {WEEKS - 1} weeks</span>
          </div>
          {(hiddenEarlier > 0 || hiddenLater > 0) && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {hiddenEarlier > 0 && `${hiddenEarlier} dated ${hiddenEarlier === 1 ? 'post is' : 'posts are'} earlier. `}
              {hiddenLater > 0 && `${hiddenLater} dated ${hiddenLater === 1 ? 'post is' : 'posts are'} later.`}
            </div>
          )}
          {/* key makes the board reset when you step to other weeks or add a post */}
          <PlanBoard key={`${start}:${visibleStart.map((i) => `${i.id}${i.date}${i.status}${i.clientStatus}`).join('|')}`} brandSpaceId={params.id} initialItems={visibleStart} start={start} weeks={WEEKS} />
        </>
      )}
    </div>
  )
}
