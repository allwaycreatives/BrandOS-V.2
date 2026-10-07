import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { getDeleteSummary } from '@/lib/brandDelete'
import DeleteBrandForm from './DeleteBrandForm'

const SERIF = "Georgia, 'Times New Roman', serif"

export default async function DeleteBrandPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const back = `/brand-spaces/${params.id}`

  if (access.role !== 'agency') {
    return (
      <div style={{ maxWidth: 560 }}>
        <div className="topbar-greeting">Delete brand</div>
        <div className="card-empty" style={{ marginTop: 16 }}>Only the workspace owner can delete a brand.</div>
        <Link href={back} style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: 'var(--accent-text)' }}>← Back</Link>
      </div>
    )
  }

  const name = access.brandSpace.name
  const s = await getDeleteSummary(params.id)
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

  const lines: string[] = [
    s.boards > 0 && `${n(s.boards, 'board', 'boards')} with ${n(s.boardCards, 'card', 'cards')}`,
    s.projects > 0 && n(s.projects, 'project', 'projects'),
    s.campaigns > 0 && n(s.campaigns, 'campaign', 'campaigns'),
    s.tasks > 0 && n(s.tasks, 'task', 'tasks'),
    s.contentItems > 0 && `${n(s.contentItems, 'calendar item', 'calendar items')}${s.postFeedback > 0 ? ` with ${n(s.postFeedback, 'client comment', 'client comments')}` : ''}. The client plan link will stop working`,
    s.ideas > 0 && n(s.ideas, 'idea', 'ideas'),
    s.deliverables > 0 && `${n(s.deliverables, 'review', 'reviews')} with ${n(s.feedback, 'piece of client feedback', 'pieces of client feedback')}. Their review links will stop working`,
    (s.discoveryAnswers > 0 || s.discoveryTemplates > 0) && `Discovery: ${n(s.discoveryAnswers, 'answer set', 'answer sets')} and ${n(s.discoveryTemplates, 'question set', 'question sets')}`,
    (s.brandKitItems > 0 || s.hasProfile) && `The brand profile and ${n(s.brandKitItems, 'brand kit item', 'brand kit items')}`,
    s.comments > 0 && n(s.comments, 'comment', 'comments'),
    s.notifications > 0 && n(s.notifications, 'update', 'updates'),
    s.faces > 0 && `${n(s.faces, 'face', 'faces')} listed for this brand`,
    s.people > 0 && `${n(s.people, 'person', 'people')} lose access (their accounts stay)`,
    s.invites > 0 && n(s.invites, 'invite link', 'invite links'),
  ].filter(Boolean) as string[]

  return (
    <div style={{ maxWidth: 620 }}>
      <Link href={back} style={{ display: 'inline-block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>← Back to {name}</Link>
      <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, margin: '0 0 6px' }}>Delete {name}</h1>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 20 }}>
        This permanently deletes the brand and everything inside it. It cannot be undone.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>What will be deleted</div>
        {lines.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This brand is empty. Only the brand itself will be removed.</div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8 }}>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>

      {s.unlinked.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>What stays</div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {s.unlinked.map((b) => b.name).join(', ')} {s.unlinked.length === 1 ? 'is' : 'are'} not deleted. {s.unlinked.length === 1 ? 'It stays' : 'They stay'} as {s.unlinked.length === 1 ? 'a brand' : 'brands'} of {s.unlinked.length === 1 ? 'its' : 'their'} own, no longer linked to {name}.
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 20 }}>
        Uploaded image files stay in storage, because boards copied from this one may still show them. Your saved templates are not affected.
      </div>

      <DeleteBrandForm brandSpaceId={params.id} brandName={name} />
    </div>
  )
}
