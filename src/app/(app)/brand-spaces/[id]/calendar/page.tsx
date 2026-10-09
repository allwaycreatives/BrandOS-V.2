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
import { parseStrategy } from '@/lib/strategy'

const COLUMNS = [
  { key: 'idea', label: 'Idea' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In Production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

const WEEKS = 4
type View = 'publish' | 'production' | 'platform' | 'board'

export default async function CalendarPage({ params, searchParams }: { params: { id: string }; searchParams: { view?: string; w?: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace } = access
  const isClient = access.role === 'client'
  const view: View = (['production', 'platform', 'board'] as const).find((v) => v === searchParams.view) ?? 'publish'
  const strategy = parseStrategy(brandSpace!.strategy)

  const items = await db.calendarItem
    .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } })
    .catch(() => [])

  const createWithId = createCalendarItem.bind(null, params.id)
  const base = `/brand-spaces/${params.id}/calendar`
  const isPlan = view === 'publish' || view === 'production'

  const tab = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
  })

  const SUB: Record<View, string> = {
    publish: 'When posts go out. Drag a post to a new day.',
    production: 'When posts are made. Drag a post to a new day.',
    platform: 'Every post, grouped by where it is published.',
    board: 'Move content through production.',
  }

  // Plan data: the date shown is the publish date or the production date, depending on the view.
  const wParam = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.w || '') ? (searchParams.w as string) : todayKey()
  const start = mondayOf(wParam)
  const field = view === 'production' ? 'production' : 'publish'
  const planItems: PlanItem[] = items.map((i) => {
    const d = field === 'production' ? i.productionDate : i.scheduledDate
    return { id: i.id, title: i.title, platform: i.platform, status: i.status, date: d ? dayKey(d) : null, clientStatus: i.clientStatus, pillar: i.pillar, priority: i.priority }
  })
  const end = addDays(start, WEEKS * 7)
  const hiddenEarlier = planItems.filter((i) => i.date && i.date < start).length
  const hiddenLater = planItems.filter((i) => i.date && i.date >= end).length
  const waiting = items.filter((i) => visibleToClient(i.status) && i.clientStatus === 'pending').length
  const visibleStart = planItems.filter((i) => !i.date || (i.date >= start && i.date < end))
  const targets = view === 'publish' ? strategy.platforms.filter((p) => p.perWeek > 0).map((p) => ({ name: p.name, perWeek: p.perWeek })) : []

  // By platform: strategy platforms first (primary, secondary, supporting), then any other platform in use.
  const roleOrder = { primary: 0, secondary: 1, supporting: 2 } as const
  const platformNames = Array.from(
    new Set([...[...strategy.platforms].sort((a, b) => roleOrder[a.role] - roleOrder[b.role]).map((p) => p.name), ...items.map((i) => i.platform)])
  )

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="topbar-greeting">Calendar</div>
          <div className="topbar-sub">{SUB[view]}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={base} style={tab(view === 'publish')}>Publishing</Link>
          <Link href={`${base}?view=production`} style={tab(view === 'production')}>Production</Link>
          <Link href={`${base}?view=platform`} style={tab(view === 'platform')}>By platform</Link>
          <Link href={`${base}?view=board`} style={tab(view === 'board')}>Status board</Link>
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
          {isPlan && <input type="date" name="date" aria-label={view === 'production' ? 'Production date (optional)' : 'Publish date (optional)'} />}
          <input type="hidden" name="dateField" value={view === 'production' ? 'production' : 'publish'} />
          {/* On the plan, a new post starts as Planned so the client can see it; elsewhere it starts as an Idea. */}
          <input type="hidden" name="status" value={isPlan ? 'planned' : 'idea'} />
          <button className="primary" type="submit">Add</button>
        </form>
      )}

      {view === 'board' && (
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
      )}

      {view === 'platform' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
          {platformNames.map((name) => {
            const role = strategy.platforms.find((p) => p.name === name)
            const list = items
              .filter((i) => i.platform === name)
              .sort((a, b) => (a.scheduledDate && b.scheduledDate ? a.scheduledDate.getTime() - b.scheduledDate.getTime() : a.scheduledDate ? -1 : b.scheduledDate ? 1 : 0))
            return (
              <div key={name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, minHeight: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {name} <span style={{ color: 'var(--text-muted)' }}>({list.length})</span>
                </div>
                {role && (
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 10px' }}>
                    {role.role[0].toUpperCase() + role.role.slice(1)}
                    {role.perWeek > 0 ? ` · ${role.perWeek} a week` : ''}
                    {role.expression ? ` · ${role.expression}` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: role ? 0 : 10 }}>
                  {list.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing here</div>}
                  {list.map((item) => (
                    <CalendarCard
                      key={item.id}
                      brandSpaceId={params.id}
                      itemId={item.id}
                      title={item.title}
                      platform={item.status === 'idea' ? 'Idea' : COLUMNS.find((c) => c.key === item.status)?.label ?? item.status}
                      date={item.scheduledDate ? dayLabel(dayKey(item.scheduledDate)) : undefined}
                      canMoveBack={false}
                      canMoveForward={false}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isPlan && (
        <>
          {!isClient && view === 'publish' && <PlanShare brandSpaceId={params.id} brandName={brandSpace!.name} token={brandSpace!.planToken} note={brandSpace!.planNote || ''} waiting={waiting} />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Link href={`${base}?${view === 'production' ? 'view=production&' : ''}w=${addDays(start, -WEEKS * 7)}`} style={tab(false)}>← Earlier</Link>
            <Link href={view === 'production' ? `${base}?view=production` : base} style={tab(false)}>This week</Link>
            <Link href={`${base}?${view === 'production' ? 'view=production&' : ''}w=${addDays(start, WEEKS * 7)}`} style={tab(false)}>Later →</Link>
            <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{weekLabel(start)} and the next {WEEKS - 1} weeks</span>
          </div>
          {(hiddenEarlier > 0 || hiddenLater > 0) && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {hiddenEarlier > 0 && `${hiddenEarlier} dated ${hiddenEarlier === 1 ? 'post is' : 'posts are'} earlier. `}
              {hiddenLater > 0 && `${hiddenLater} dated ${hiddenLater === 1 ? 'post is' : 'posts are'} later.`}
            </div>
          )}
          {/* key makes the board reset when you step to other weeks, switch views, or add a post */}
          <PlanBoard
            key={`${view}:${start}:${visibleStart.map((i) => `${i.id}${i.date}${i.status}${i.clientStatus}${i.pillar}${i.priority}`).join('|')}`}
            brandSpaceId={params.id}
            initialItems={visibleStart}
            start={start}
            weeks={WEEKS}
            dateField={field}
            targets={targets}
          />
        </>
      )}
    </div>
  )
}
