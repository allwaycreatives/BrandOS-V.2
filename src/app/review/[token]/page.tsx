import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import DeliverablePreview from '@/components/DeliverablePreview'
import ReviewForm from './ReviewForm'
import { REVIEW_STATUS, KIND_LABEL } from '@/app/(app)/brand-spaces/[id]/reviews/constants'

const SERIF = "Georgia, 'Times New Roman', serif"
const when = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// Public review page. Clients open this from a link (often sent on WhatsApp). No account needed.
export default async function ReviewPage({ params }: { params: { token: string } }) {
  const d = await db.deliverable
    .findUnique({ where: { reviewToken: params.token }, include: { feedback: { orderBy: { createdAt: 'asc' } }, brandSpace: { select: { name: true } } } })
    .catch(() => null)
  if (!d) notFound()

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 60px' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>For review · {d.brandSpace.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, margin: 0 }}>{d.title}</h1>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Version {d.version} · {REVIEW_STATUS[d.status] ?? d.status}</div>
      </div>

      <DeliverablePreview url={d.url} />
      {d.notes && <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: '14px 0 0' }}>{d.notes}</p>}

      {d.feedback.length > 0 && (
        <div style={{ margin: '28px 0 22px' }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Conversation</div>
          {d.feedback.map((f) => (
            <div key={f.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>{f.authorName}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {f.fromClient ? KIND_LABEL[f.kind] : 'Team'} · v{f.version} · {when(f.createdAt)}
                  {f.at ? ` · at ${f.at}` : ''}
                </span>
                {f.fromClient && f.kind === 'changes_requested' && f.resolved && <span style={{ fontSize: 11.5, color: 'var(--accent)' }}>Addressed</span>}
              </div>
              {f.body && <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{f.body}</div>}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: d.feedback.length > 0 ? 0 : 28 }}>
        <ReviewForm token={params.token} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 28 }}>Made with Brand OS</div>
    </main>
  )
}
