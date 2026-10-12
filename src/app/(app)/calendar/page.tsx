import BrandDot from '@/components/BrandDot'
import Link from 'next/link'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import { getAgenda } from '@/lib/agenda'
import { addDays, dayLabel, gridDayLabel, lastDayOf, mondayOf, monthKeyOf, monthTitle, todayKey, weekdayShort } from '@/lib/plan'

const DocIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0, opacity: 0.6 }} aria-hidden="true">
    <path d="M4 1.7h5.2L12.3 5v9.3H4z" strokeLinejoin="round" />
    <path d="M9 1.8V5h3.2M6 8h4.3M6 10.6h4.3" strokeLinecap="round" />
  </svg>
)
const CameraIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ flexShrink: 0, opacity: 0.8 }} aria-hidden="true">
    <rect x="1.8" y="4.2" width="9" height="7.6" rx="1.4" />
    <path d="M10.8 7l3.4-1.8v5.6L10.8 9z" strokeLinejoin="round" />
  </svg>
)

// Every brand's calendar in one place: who goes out when, and who is filming when. Colour shows the brand.
export default async function AllCalendarsPage({ searchParams }: { searchParams: { m?: string; brand?: string } }) {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')

  if (brands.length === 0) {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="topbar-greeting">All calendars</div>
        <div className="card-empty" style={{ marginTop: 16 }}>Create a brand first, then its posts and shoots will show up here.</div>
      </div>
    )
  }

  const filterId = brands.find((b) => b.id === searchParams.brand)?.id
  const shown = filterId ? brands.filter((b) => b.id === filterId) : brands
  const byId = new Map(brands.map((b) => [b.id, b]))

  const monthKey = /^\d{4}-\d{2}$/.test(searchParams.m || '') ? (searchParams.m as string) : monthKeyOf(todayKey())
  const firstDay = `${monthKey}-01`
  const lastDay = lastDayOf(monthKey)
  const start = mondayOf(firstDay)
  const weeks = Math.ceil((Math.round((Date.parse(lastDay) - Date.parse(start)) / 86400000) + 1) / 7)
  const gridEnd = addDays(start, weeks * 7)
  const today = todayKey()

  const { posts, shoots } = await getAgenda(shown.map((b) => b.id), start, gridEnd)

  const qs = (m: string) => `/calendar?m=${m}${filterId ? `&brand=${filterId}` : ''}`
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 999,
    fontSize: 12.5,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  })
  const dot = (c: string) => <BrandDot size={9} color={c} />

  return (
    <div>
      <div className="topbar-greeting">All calendars</div>
      <div className="topbar-sub" style={{ marginBottom: 16 }}>Every brand together: posts going out, and shoot days. Each brand has its own colour.</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Link href={`/calendar?m=${monthKey}`} style={pill(!filterId)}>All brands</Link>
        {brands.map((b) => (
          <Link key={b.id} href={`/calendar?m=${monthKey}&brand=${b.id}`} style={pill(filterId === b.id)}>
            {dot(b.color)} {b.name}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 600, marginRight: 8 }}>{monthTitle(monthKey)}</div>
        <Link href={qs(monthKeyOf(addDays(firstDay, -1)))} style={pill(false)} aria-label="Previous month">←</Link>
        <Link href={`/calendar${filterId ? `?brand=${filterId}` : ''}`} style={pill(false)}>Today</Link>
        <Link href={qs(monthKeyOf(addDays(lastDay, 1)))} style={pill(false)} aria-label="Next month">→</Link>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><DocIcon /> post going out</span>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><CameraIcon /> shoot day</span>
      </div>

      <div className="plan-weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, d) => (
          <div key={d}>{weekdayShort(addDays(start, d))}</div>
        ))}
      </div>

      {Array.from({ length: weeks }, (_, w) => {
        const monday = addDays(start, w * 7)
        return (
          <div key={monday} className="plan-week" style={{ marginBottom: 8 }}>
            {Array.from({ length: 7 }, (_, d) => {
              const key = addDays(monday, d)
              const dayShoots = shoots.filter((s) => s.date === key)
              const dayPosts = posts.filter((p) => p.date === key)
              const empty = dayShoots.length + dayPosts.length === 0
              const outside = monthKeyOf(key) !== monthKey
              return (
                <div key={key} className={`plan-day${key === today ? ' is-today' : ''}${empty ? ' is-empty' : ''}${outside ? ' is-outside' : ''}`}>
                  <div className="plan-dhead">
                    <span className="plan-dwk">{weekdayShort(key)}</span>
                    <span className={`plan-dnum${key === today ? ' is-today' : ''}`}>{gridDayLabel(key)}</span>
                  </div>
                  {dayShoots.map((s) => {
                    const b = byId.get(s.brandId)
                    if (!b) return null
                    return (
                      <div key={`s-${s.brandId}`} className="plan-chip" style={{ borderLeft: `3px solid ${b.color}`, cursor: 'default' }} title={`${b.name}: shoot day, ${s.count} ${s.count === 1 ? 'post' : 'posts'}`}>
                        <Link href={`/brand-spaces/${b.id}/shoot/${key}`}>
                          <CameraIcon />
                          <span className="t">Shoot · {s.count}</span>
                        </Link>
                      </div>
                    )
                  })}
                  {dayPosts.map((p) => {
                    const b = byId.get(p.brandId)
                    if (!b) return null
                    return (
                      <div key={p.id} className={`plan-chip${p.status === 'idea' ? ' is-idea' : ''}`} style={{ borderLeft: `3px solid ${b.color}`, cursor: 'default' }} title={`${b.name} · ${p.platform}${p.status === 'idea' ? ' · Idea' : ''}`}>
                        <Link href={`/brand-spaces/${b.id}/calendar/${p.id}`}>
                          <DocIcon />
                          <span className="t">{p.time ? `${p.time} · ` : ''}{p.title || 'Untitled'}</span>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
      {posts.length + shoots.length === 0 && <div className="card-empty" style={{ marginTop: 12 }}>Nothing is scheduled in {monthTitle(monthKey)} for {filterId ? byId.get(filterId)?.name : 'these brands'}.</div>}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
        To move a post, open its brand&apos;s calendar. Shoot days link to that day&apos;s shoot sheet. Dates shown: {dayLabel(start)} to {dayLabel(addDays(gridEnd, -1))}.
      </div>
    </div>
  )
}
