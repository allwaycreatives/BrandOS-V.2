import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { PROJECT_STAGES } from '../constants'
import { updateProject, setProjectStatus, addProjectTask, setProjectTaskStatus, addProjectBoard } from '../actions'
import DeleteProjectButton from '../DeleteProjectButton'
import SaveTemplateButton from '@/components/SaveTemplateButton'
import { createDeliverable } from '../../reviews/actions'
import { REVIEW_STATUS } from '../../reviews/constants'
import { createGallery } from '../../galleries/actions'
import { formatBytes } from '@/lib/galleryFormat'

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')
const SERIF = "Georgia, 'Times New Roman', serif"

export default async function ProjectPage({ params }: { params: { id: string; projectId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()

  const project = await db.project.findUnique({ where: { id: params.projectId } }).catch(() => null)
  if (!project || project.brandSpaceId !== params.id) notFound()

  const tasks = await db.task.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } }).catch(() => [])
  const boards = await db.board
    .findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { cards: true } } } })
    .catch(() => [])

  const deliverables = await db.deliverable.findMany({ where: { projectId: project.id }, orderBy: { updatedAt: 'desc' } }).catch(() => [])

  const galleries = await db.gallery
    .findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'desc' }, include: { items: { select: { id: true, size: true, thumbUrl: true, driveThumbId: true } } } })
    .catch(() => [])

  const stageIndex = PROJECT_STAGES.findIndex((s) => s.key === project.status)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/projects`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Projects
      </Link>

      <div style={{ marginTop: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{project.name}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <SaveTemplateButton kind="project" sourceId={project.id} defaultName={project.name} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {PROJECT_STAGES.map((s, i) => (
          <form key={s.key} action={setProjectStatus.bind(null, project.id, s.key)} style={{ flex: 1, minWidth: 110 }}>
            <button
              type="submit"
              style={{ width: '100%', padding: '8px 6px', fontSize: 12.5, borderColor: i === stageIndex ? 'var(--accent)' : undefined, color: i <= stageIndex ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {s.label}
            </button>
          </form>
        ))}
      </div>

      {project.brief && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>Client brief</div>
            {project.briefFrom && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>From {project.briefFrom}</div>}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.brief}</div>
        </div>
      )}

      <form action={updateProject.bind(null, project.id)} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10, marginBottom: 26, alignItems: 'end' }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
          Brief
          <input name="description" defaultValue={project.description ?? ''} placeholder="What is this project and what does done look like?" style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Name
          <input name="name" defaultValue={project.name} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <input type="hidden" name="status" value={project.status} />
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Due
          <input type="date" name="dueDate" defaultValue={day(project.dueDate)} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <button className="primary" type="submit">Save</button>
      </form>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Tasks</div>
      <div style={{ marginBottom: 10 }}>
        {tasks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks yet.</div>}
        {tasks.map((t) => {
          const done = t.status === 'done'
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <form action={setProjectTaskStatus.bind(null, t.id, done ? 'open' : 'done')}>
                <button type="submit" aria-label={done ? 'Mark as not done' : 'Mark as done'} style={{ width: 20, height: 20, padding: 0, borderRadius: 4 }}>{done ? '✓' : ''}</button>
              </form>
              <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-muted)' : undefined }}>{t.title}</span>
              {t.dueDate && <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{t.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
            </div>
          )
        })}
      </div>
      <form action={addProjectTask.bind(null, project.id)} style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <input name="title" required placeholder="Add a task" style={{ flex: 1, minWidth: 220 }} />
        <input type="date" name="dueDate" />
        <button type="submit">Add task</button>
      </form>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Deliverables for review</div>
      <div style={{ marginBottom: 10 }}>
        {deliverables.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing sent to the client yet.</div>}
        {deliverables.map((dl) => (
          <Link key={dl.id} href={`/brand-spaces/${params.id}/reviews/${dl.id}`} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
            <span style={{ flex: 1 }}>{dl.title}</span>
            <span style={{ fontSize: 12, color: dl.status === 'changes_requested' ? 'var(--accent-text)' : 'var(--text-secondary)' }}>v{dl.version} · {REVIEW_STATUS[dl.status] ?? dl.status}</span>
          </Link>
        ))}
      </div>
      <form action={createDeliverable} style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <input type="hidden" name="brandSpaceId" value={params.id} />
        <input type="hidden" name="projectId" value={project.id} />
        <input name="title" required placeholder="What are you sending?" style={{ flex: 1, minWidth: 180 }} />
        <input name="url" required placeholder="Link to it" style={{ flex: 1, minWidth: 180 }} />
        <button type="submit">Add for review</button>
      </form>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Photo & video delivery</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>Full-quality photos and videos, delivered to the client with one private link.</div>
      <div style={{ marginBottom: 10 }}>
        {galleries.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing delivered yet.</div>}
        {galleries.map((g) => {
          const ci = g.items.find((i) => i.id === g.coverItemId && (i.thumbUrl || i.driveThumbId)) ?? g.items.find((i) => i.thumbUrl || i.driveThumbId)
          const thumb = ci ? (ci.driveThumbId ? `/api/gallery-admin/${g.id}/file/${ci.id}?v=t` : ci.thumbUrl) : null
          return (
            <Link key={g.id} href={`/brand-spaces/${params.id}/galleries/${g.id}`} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <span style={{ width: 52, height: 52, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                {thumb && <img src={thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600 }}>{g.title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {g.items.length} item{g.items.length === 1 ? '' : 's'} · {formatBytes(g.items.reduce((n, i) => n + i.size, 0))}
                </span>
              </span>
              <span style={{ fontSize: 12, color: g.published ? 'var(--accent-text)' : 'var(--text-muted)' }}>{g.published ? '● Delivered' : '○ Draft'}</span>
            </Link>
          )
        })}
      </div>
      <form action={createGallery} style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        <input type="hidden" name="brandSpaceId" value={params.id} />
        <input type="hidden" name="projectId" value={project.id} />
        <input name="title" required defaultValue={project.name} placeholder="Gallery name" style={{ flex: 1, minWidth: 180 }} />
        <button type="submit">Create gallery</button>
      </form>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Boards</div>
      {boards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12, marginBottom: 12 }}>
          {boards.map((b) => (
            <Link key={b.id} href={`/brand-spaces/${params.id}/boards/${b.id}`} className="card">
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{b.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b._count.cards} {b._count.cards === 1 ? 'card' : 'cards'}</div>
            </Link>
          ))}
        </div>
      )}
      <form action={addProjectBoard.bind(null, project.id)} style={{ display: 'flex', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
        <input name="name" required placeholder="New board for this project, e.g. Shot list" style={{ flex: 1, minWidth: 220 }} />
        <button type="submit">Add board</button>
      </form>

      <DeleteProjectButton projectId={project.id} />
    </div>
  )
}
