import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createTask } from './actions'
import TaskCard from './TaskCard'

export default async function TasksPage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const tasks = await db.task
    .findMany({
      where: { brandSpaceId: params.id },
      orderBy: { createdAt: 'desc' },
      include: { assignee: { select: { name: true, email: true } } },
    })
    .catch(() => [])

  // Possible assignees: anyone in the owning organization, plus anyone
  // specifically invited to this brand space.
  const orgMembers = await db.membership
    .findMany({ where: { organizationId: brandSpace.organizationId }, include: { user: true } })
    .catch(() => [])
  const invited = await db.brandSpaceAccess
    .findMany({ where: { brandSpaceId: params.id }, include: { user: true } })
    .catch(() => [])

  const assigneeOptions = new Map<string, { id: string; label: string }>()
  for (const m of orgMembers) assigneeOptions.set(m.user.id, { id: m.user.id, label: m.user.name || m.user.email })
  for (const a of invited) assigneeOptions.set(a.user.id, { id: a.user.id, label: a.user.name || a.user.email })

  const createWithId = createTask.bind(null, params.id)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Tasks</div>
        <div className="topbar-sub">For quick jobs that don't need the full discovery process — a title, a file, an assignee.</div>
      </div>

      <form action={createWithId} className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input name="title" required placeholder="What needs to be done? e.g. 'Write a title for the launch video'" />
        <textarea name="description" rows={2} placeholder="Any extra detail (optional)" />
        <input name="fileUrl" placeholder="Google Drive link to the file (optional)" />
        <select name="assigneeUserId" defaultValue="">
          <option value="">Unassigned</option>
          {Array.from(assigneeOptions.values()).map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        <button className="primary" type="submit">Add task</button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.length === 0 && <div className="card-empty">No tasks yet.</div>}
        {tasks.map((task) => (
          <TaskCard key={task.id} brandSpaceId={params.id} task={task} />
        ))}
      </div>
    </div>
  )
}
