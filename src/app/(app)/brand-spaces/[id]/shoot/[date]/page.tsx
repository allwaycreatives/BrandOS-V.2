import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { dayKey, dayLong, parseDay } from '@/lib/plan'
import { typeOf } from '@/lib/contentOptions'

const SERIF = "Georgia, 'Times New Roman', serif"

// Everything to film on one production day: what to shoot, grouped by kind, with each post's notes and script.
export default async function ShootSheetPage(props: { params: Promise<{ id: string; date: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const day = parseDay(params.date)
  if (!day) notFound()
  if (access.role === 'client') {
    return <div className="card-empty" style={{ maxWidth: 560 }}>This page is for the team.</div>
  }

  const posts = await db.calendarItem.findMany({ where: { brandSpaceId: params.id, productionDate: day }, orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }] })
  const kindOf = (t: string | null) => {
    const ty = typeOf(t)
    if (!ty) return 'unset'
    if (ty.video) return 'video'
    if (t === 'image' || t === 'carousel') return 'photo'
    return 'written'
  }
  const count = (k: string) => posts.filter((p) => kindOf(p.contentType) === k).length
  const parts = [
    count('video') && `${count('video')} ${count('video') === 1 ? 'video' : 'videos'}`,
    count('photo') && `${count('photo')} ${count('photo') === 1 ? 'photo or graphic' : 'photos or graphics'}`,
    count('written') && `${count('written')} written (no filming)`,
    count('unset') && `${count('unset')} with no format set`,
  ].filter(Boolean)

  const monthKey = params.date.slice(0, 7)
  return (
    <div style={{ maxWidth: 760 }}>
      <Link href={`/brand-spaces/${params.id}/calendar?view=production&m=${monthKey}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← Production calendar</Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shoot sheet · {access.brandSpace.name}</div>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, margin: '2px 0 6px' }}>{dayLong(params.date)}</h1>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{posts.length === 0 ? 'Nothing is planned for this day.' : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} to make: ${parts.join(', ')}.`}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {posts.map((p, i) => {
          const ty = typeOf(p.contentType)
          const kind = kindOf(p.contentType)
          return (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, overflowWrap: 'anywhere' }}>{i + 1}. {p.title}</div>
                <Link href={`/brand-spaces/${params.id}/calendar/${p.id}`} style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>Open the post →</Link>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
                {[ty ? ty.label.split(' (')[0] : 'Format not set', p.platform, p.scheduledDate ? `Goes out ${dayLong(dayKey(p.scheduledDate))}${p.publishTime ? ` at ${p.publishTime}` : ''}` : 'No publish date'].join(' · ')}
              </div>
              {p.hook && <div style={{ fontSize: 14, marginBottom: 8 }}><strong>Hook:</strong> {p.hook}</div>}
              {p.productionNotes ? (
                <div style={{ fontSize: 13.5, marginBottom: 8, whiteSpace: 'pre-wrap' }}><strong>{kind === 'video' ? 'Production notes' : 'Notes'}:</strong> {p.productionNotes}</div>
              ) : kind !== 'written' ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>No production notes yet.</div>
              ) : null}
              {p.script && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>The brief</summary>
                  <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 8 }}>{p.script}</div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
