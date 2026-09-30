import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { PROJECT_STAGES } from '../constants'
import { updateProject, setProjectStatus, addProjectTask, setProjectTaskStatus, addProjectBoard, duplicateProject } from '../actions'
import DeleteProjectButton from '../DeleteProjectButton'

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

  const stageIndex = PROJECT_STAGES.findIndex((s) => s.key === project.status)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/projects`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Projects
      </Link>

      <div style={{ marginTop: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{project.name}</h1>
        <form action={duplicateProject.bind(null, project.id)}>
          <button type="submit">Duplicate project</button>
        </form>
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

      <form action={updateProject.bind(null, project.id)} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 26, alignItems: 'end' }}>
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

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Boards</div>
      {boards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
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
