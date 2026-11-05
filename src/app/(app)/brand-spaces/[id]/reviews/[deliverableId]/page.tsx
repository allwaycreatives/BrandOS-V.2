import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import DeliverablePreview from '@/components/DeliverablePreview'
import PinnableImage from '@/components/PinnableImage'
import { getEmbed } from '@/lib/embed'
import { REVIEW_STATUS, KIND_LABEL } from '../constants'
import { postNewVersion, addTeamReply, resolveFeedback, resolveAllFeedback } from '../actions'
import ReviewShare from '../ReviewShare'
import DeleteDeliverableButton from '../DeleteDeliverableButton'

const SERIF = "Georgia, 'Times New Roman', serif"
const when = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const small: React.CSSProperties = { padding: '2px 9px', fontSize: 11.5 }

export default async function DeliverablePage(props: { params: Promise<{ id: string; deliverableId: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()

  const d = await db.deliverable
    .findUnique({ where: { id: params.deliverableId }, include: { feedback: { orderBy: { createdAt: 'asc' } }, project: { select: { name: true } } } })
    .catch(() => null)
  if (!d || d.brandSpaceId !== params.id) notFound()

  const isImage = getEmbed(d.url).kind === 'image'
  const pinned = d.feedback.filter((f) => f.pinX != null && f.pinY != null && f.version === d.version && f.fromClient)
  const pinNumber = new Map(pinned.map((f, i) => [f.id, i + 1]))
  const pins = pinned.map((f, i) => ({ id: f.id, n: i + 1, x: f.pinX as number, y: f.pinY as number, resolved: f.resolved }))

  const openChanges = d.feedback.filter((f) => f.fromClient && f.kind === 'changes_requested' && !f.resolved).length

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/reviews`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Reviews
      </Link>

      <div style={{ marginTop: 8, marginBottom: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{d.title}</h1>
        <div style={{ fontSize: 12.5, color: d.status === 'changes_requested' ? 'var(--accent-text)' : 'var(--text-secondary)' }}>
          Version {d.version} · {REVIEW_STATUS[d.status] ?? d.status}
          {d.project ? ` · ${d.project.name}` : ''}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20, alignItems: 'start', marginBottom: 28 }}>
        <div>
          {isImage ? <PinnableImage src={d.url} pins={pins} /> : <DeliverablePreview url={d.url} />}
          {d.notes && <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: '12px 0 0' }}>{d.notes}</p>}
        </div>
        <ReviewShare deliverableId={d.id} title={d.title} token={d.reviewToken} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Feedback {openChanges > 0 ? `· ${openChanges} to address` : ''}</div>
        {openChanges > 0 && (
          <form action={resolveAllFeedback.bind(null, d.id)}>
            <button type="submit" style={small}>Mark all addressed</button>
          </form>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        {d.feedback.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>Nothing yet. When the client comments, it shows up here.</div>}
        {d.feedback.map((f) => (
          <div key={f.id} id={`fb-${f.id}`} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontWeight: 600 }}>{f.authorName}</span>
                <span style={{ fontSize: 11.5, color: f.kind === 'changes_requested' && f.fromClient && !f.resolved ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                  {f.fromClient ? KIND_LABEL[f.kind] : 'Team'} · v{f.version} · {when(f.createdAt)}
                  {f.at ? ` · at ${f.at}` : ''}
                </span>
                {f.pinX != null && <span style={{ fontSize: 11.5, color: 'var(--accent-text)' }}>{pinNumber.has(f.id) ? `Pin ${pinNumber.get(f.id)}` : 'Pinned'}</span>}
              </div>
              {f.body && <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{f.body}</div>}
            </div>
            {f.fromClient && f.kind !== 'approved' && (
              <form action={resolveFeedback.bind(null, f.id, !f.resolved)}>
                <button type="submit" style={small}>{f.resolved ? 'Addressed ✓' : 'Mark addressed'}</button>
              </form>
            )}
          </div>
        ))}
      </div>

      <form action={addTeamReply.bind(null, d.id)} style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <input name="body" required placeholder="Reply to the client (they see this on the review page)" style={{ flex: 1, minWidth: 240 }} />
        <button type="submit">Reply</button>
      </form>

      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Upload a new version</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
          After making the changes, paste the new link (or leave it empty to keep the same one). The client sees it is a new version.
        </div>
        <form action={postNewVersion.bind(null, d.id)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input name="url" placeholder="New link (optional)" style={{ flex: 1, minWidth: 200 }} />
          <input name="note" placeholder="What changed?" style={{ flex: 1, minWidth: 200 }} />
          <button className="primary" type="submit">Post version {d.version + 1}</button>
        </form>
      </div>

      <DeleteDeliverableButton deliverableId={d.id} />
    </div>
  )
}
