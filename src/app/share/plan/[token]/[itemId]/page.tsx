import Link from 'next/link'
import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import PostPlayer from '@/components/PostPlayer'
import PostFeedback from './PostFeedback'
import { db } from '@/lib/db'
import { dayKey, dayLong, CLIENT_STATUS_CLIENT, KIND_WORD } from '@/lib/plan'

export const dynamic = 'force-dynamic'
const SERIF = "Georgia, 'Times New Roman', serif"
const when = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// One post, the way the client should judge it: the video as it will really look, the thumbnail and caption beside it.
export default async function PlanPostPage(props: { params: Promise<{ token: string; itemId: string }> }) {
  const params = await props.params;
  const brand = await db.brandSpace.findUnique({ where: { planToken: params.token }, select: { id: true, name: true } }).catch(() => null)
  if (!brand) notFound()

  const all = await db.calendarItem.findMany({
    where: { brandSpaceId: brand.id, status: { not: 'idea' } },
    orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  })
  const index = all.findIndex((i) => i.id === params.itemId)
  if (index === -1) notFound()
  const item = await db.calendarItem.findUnique({ where: { id: params.itemId }, include: { feedback: { orderBy: { createdAt: 'asc' } } } })
  if (!item) notFound()

  const prev = index > 0 ? all[index - 1].id : null
  const next = index < all.length - 1 ? all[index + 1].id : null
  const base = `/share/plan/${params.token}`

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Link href={base} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← The whole plan</Link>
        <ThemeToggle />
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        {brand.name} · {item.scheduledDate ? dayLong(dayKey(item.scheduledDate)) : 'Date to be confirmed'} · {item.platform}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, margin: 0, overflowWrap: 'anywhere' }}>{item.title}</h1>
        <div style={{ fontSize: 12.5, color: item.clientStatus === 'approved' ? 'var(--accent-text)' : 'var(--text-secondary)' }}>{CLIENT_STATUS_CLIENT[item.clientStatus] ?? item.clientStatus}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24, alignItems: 'start' }}>
        <PostPlayer url={item.assetUrl} platform={item.platform} thumbnailUrl={item.thumbnailUrl} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {item.thumbnailUrl && item.assetUrl && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Thumbnail</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbnailUrl} alt="Thumbnail" style={{ width: 140, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border-strong)' }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Caption</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {item.caption || <span style={{ color: 'var(--text-muted)' }}>The caption has not been written yet.</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, marginTop: 28 }}>
        {item.feedback.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Conversation</div>
            {item.feedback.map((f) => (
              <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{f.authorName}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {f.fromClient ? KIND_WORD[f.kind] : 'Team'} · {when(f.createdAt)}
                    {f.at ? ` · at ${f.at}` : ''}
                  </span>
                  {f.fromClient && f.kind === 'changes_requested' && f.resolved && <span style={{ fontSize: 11.5, color: 'var(--accent-text)' }}>Addressed</span>}
                </div>
                {f.body && <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{f.body}</div>}
              </div>
            ))}
          </div>
        )}
        <PostFeedback token={params.token} itemId={item.id} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 12 }}>
          {prev ? <Link href={`${base}/${prev}`} style={{ fontSize: 13, color: 'var(--accent-text)' }}>← Previous post</Link> : <span />}
          {next ? <Link href={`${base}/${next}`} style={{ fontSize: 13, color: 'var(--accent-text)' }}>Next post →</Link> : <span />}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 28 }}>Made with Brand Console</div>
    </main>
  )
}
