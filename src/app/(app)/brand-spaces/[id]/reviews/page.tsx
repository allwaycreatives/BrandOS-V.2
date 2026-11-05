import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { REVIEW_STATUS, KIND_LABEL } from './constants'
import { createDeliverable } from './actions'
import StyleSummary from './StyleSummary'
import DeliverableUrlField from './DeliverableUrlField'

const SERIF = "Georgia, 'Times New Roman', serif"
const when = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default async function ReviewsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()
  const { brandSpace } = access

  const deliverables = await db.deliverable
    .findMany({ where: { brandSpaceId: params.id }, orderBy: { updatedAt: 'desc' }, include: { feedback: true, project: { select: { name: true } } } })
    .catch(() => [])
  const projects = await db.project.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }).catch(() => [])

  const approved = deliverables.filter((d) => d.status === 'approved')
  const avgRounds = approved.length ? (approved.reduce((n, d) => n + d.version, 0) / approved.length).toFixed(1) : '–'
  const openChanges = deliverables.reduce((n, d) => n + d.feedback.filter((f) => f.fromClient && f.kind === 'changes_requested' && !f.resolved).length, 0)

  const recent = deliverables
    .flatMap((d) => d.feedback.filter((f) => f.fromClient).map((f) => ({ ...f, deliverableId: d.id, title: d.title })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Reviews</div>
        <div className="topbar-sub">Send work to {brandSpace.name} for feedback and approval. Every comment is kept, so you learn what they like.</div>
      </div>

      <form action={createDeliverable} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <input type="hidden" name="brandSpaceId" value={params.id} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="title" required placeholder="What are you sending? e.g. Launch reel, cut 1" style={{ flex: 1, minWidth: 200 }} />
          <DeliverableUrlField />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="notes" placeholder="A note for the client (optional)" style={{ flex: 1, minWidth: 200 }} />
          {projects.length > 0 && (
            <select name="projectId" defaultValue="">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <button className="primary" type="submit">Add deliverable</button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="card"><div style={{ fontSize: 22, fontWeight: 600 }}>{deliverables.length}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Deliverables</div></div>
        <div className="card"><div style={{ fontSize: 22, fontWeight: 600 }}>{approved.length}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Approved</div></div>
        <div className="card"><div style={{ fontSize: 22, fontWeight: 600 }}>{avgRounds}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Avg versions to approval</div></div>
        <div className="card"><div style={{ fontSize: 22, fontWeight: 600, color: openChanges ? 'var(--accent-text)' : undefined }}>{openChanges}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Changes to address</div></div>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Deliverables</div>
      <div style={{ marginBottom: 28 }}>
        {deliverables.length === 0 && <div className="card-empty">Nothing sent yet. Add a link above, then create a review link to send to the client.</div>}
        {deliverables.map((d) => {
          const open = d.feedback.filter((f) => f.fromClient && f.kind === 'changes_requested' && !f.resolved).length
          return (
            <Link key={d.id} href={`/brand-spaces/${params.id}/reviews/${d.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15 }}>{d.title}</span>
                {d.project && <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>{d.project.name}</span>}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>v{d.version}</span>
              <span style={{ fontSize: 12, color: d.status === 'changes_requested' ? 'var(--accent-text)' : 'var(--text-secondary)', minWidth: 120, textAlign: 'right' }}>
                {REVIEW_STATUS[d.status] ?? d.status}
                {open > 0 ? ` · ${open}` : ''}
              </span>
            </Link>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, alignItems: 'start' }}>
        <StyleSummary brandSpaceId={params.id} initial={brandSpace.styleSummary ?? ''} updatedAt={brandSpace.styleSummaryAt ? when(brandSpace.styleSummaryAt) : null} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Recent client feedback</div>
          {recent.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No feedback yet.</div>}
          {recent.map((f) => (
            <Link key={f.id} href={`/brand-spaces/${params.id}/reviews/${f.deliverableId}`} style={{ display: 'block', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ fontSize: 11.5, color: f.kind === 'changes_requested' && !f.resolved ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                {f.authorName} · {KIND_LABEL[f.kind]} · {f.title} · {when(f.createdAt)}
              </div>
              {f.body && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{f.body.length > 140 ? `${f.body.slice(0, 140)}…` : f.body}</div>}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
