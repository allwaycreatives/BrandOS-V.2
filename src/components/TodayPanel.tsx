import Link from 'next/link'
import { getAgenda } from '@/lib/agenda'
import { addDays, todayKey } from '@/lib/plan'

type Brand = { id: string; name: string; color: string }

// Home: which brand do we work on today, and for what? Shoots and posts going out, today and tomorrow, across every brand.
export default async function TodayPanel({ brands }: { brands: Brand[] }) {
  const today = todayKey()
  const tomorrow = addDays(today, 1)
  const { posts, shoots } = await getAgenda(brands.map((b) => b.id), today, addDays(today, 2))
  const byId = new Map(brands.map((b) => [b.id, b]))

  const day = (key: string, label: string) => {
    const s = shoots.filter((x) => x.date === key && byId.has(x.brandId))
    const p = posts.filter((x) => x.date === key && byId.has(x.brandId) && x.status !== 'idea')
    return (
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>{label}</div>
        {s.length + p.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing scheduled.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.map((x) => {
              const b = byId.get(x.brandId) as Brand
              return (
                <Link key={`s-${x.brandId}`} href={`/brand-spaces/${b.id}/shoot/${key}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                  <span><strong>Shoot</strong> · {b.name} · {x.count} {x.count === 1 ? 'post' : 'posts'} →</span>
                </Link>
              )
            })}
            {p.map((x) => {
              const b = byId.get(x.brandId) as Brand
              return (
                <Link key={x.id} href={`/brand-spaces/${b.id}/calendar/${x.id}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{x.time ? `${x.time} · ` : ''}{x.title} <span style={{ color: 'var(--text-muted)' }}>· {b.name} · {x.platform}</span></span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Today</div>
        <Link href="/calendar" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>All calendars</Link>
      </div>
      <div className="card" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {day(today, 'Today')}
        {day(tomorrow, 'Tomorrow')}
      </div>
    </div>
  )
}
