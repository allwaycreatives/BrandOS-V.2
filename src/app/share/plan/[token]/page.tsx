import Link from 'next/link'
import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { db } from '@/lib/db'
import { dayKey, dayLabel, mondayOf, weekLabel, CLIENT_STATUS_CLIENT } from '@/lib/plan'

export const dynamic = 'force-dynamic'
const SERIF = "Georgia, 'Times New Roman', serif"

// Public content plan. Clients open it from a link (often on WhatsApp), scroll week by week, and open any post to comment or approve.
export default async function PlanPage({ params }: { params: { token: string } }) {
  const brand = await db.brandSpace.findUnique({ where: { planToken: params.token }, select: { id: true, name: true, planNote: true } }).catch(() => null)
  if (!brand) notFound()

  const items = await db.calendarItem.findMany({
    where: { brandSpaceId: brand.id, status: { not: 'idea' } },
    orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, title: true, platform: true, scheduledDate: true, hook: true, thumbnailUrl: true, clientStatus: true },
  })

  const dated = items.filter((i) => i.scheduledDate)
  const undated = items.filter((i) => !i.scheduledDate)
  const weeks: { monday: string; posts: typeof items }[] = []
  for (const i of dated) {
    const monday = mondayOf(dayKey(i.scheduledDate as Date))
    const last = weeks[weeks.length - 1]
    if (last && last.monday === monday) last.posts.push(i)
    else weeks.push({ monday, posts: [i] })
  }

  const approved = items.filter((i) => i.clientStatus === 'approved').length
  const waiting = items.filter((i) => i.clientStatus === 'pending').length
  const base = `/share/plan/${params.token}`

  const card = (i: (typeof items)[number]) => (
    <Link key={i.id} href={`${base}/${i.id}`} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
      {i.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={i.thumbnailUrl} alt="" style={{ width: 54, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid var(--border)' }} />
      ) : (
        <div style={{ width: 54, aspectRatio: '9 / 16', borderRadius: 6, flexShrink: 0, background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }} />
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {i.scheduledDate ? dayLabel(dayKey(i.scheduledDate)) : 'Date to be confirmed'} · {i.platform}
        </div>
        <div style={{ fontWeight: 600, fontSize: 15, margin: '2px 0 4px', overflowWrap: 'anywhere' }}>{i.title}</div>
        {i.hook && <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflowWrap: 'anywhere' }}>{i.hook}</div>}
      </div>
      <div style={{ fontSize: 12, textAlign: 'right', flexShrink: 0, maxWidth: 110, color: i.clientStatus === 'approved' ? 'var(--accent-text)' : 'var(--text-secondary)' }}>
        {CLIENT_STATUS_CLIENT[i.clientStatus] ?? i.clientStatus}
      </div>
    </Link>
  )

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><ThemeToggle /></div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Content plan</div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, margin: '0 0 12px' }}>{brand.name}</h1>

      {brand.planNote && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>The direction</div>
          <div style={{ fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{brand.planNote}</div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="card-empty">Nothing has been added to the plan yet. Check back soon.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 22 }}>
            {items.length} {items.length === 1 ? 'post' : 'posts'} · {approved} approved · {waiting} waiting for your review. Tap a post to watch it, comment or approve.
          </div>
          {weeks.map((w) => (
            <section key={w.monday} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Week of {weekLabel(w.monday)}</div>
              {w.posts.map(card)}
            </section>
          ))}
          {undated.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Dates to be confirmed</div>
              {undated.map(card)}
            </section>
          )}
        </>
      )}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 28 }}>Made with Brand Console</div>
    </main>
  )
}
