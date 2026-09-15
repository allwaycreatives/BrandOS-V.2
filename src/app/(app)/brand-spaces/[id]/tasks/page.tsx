import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import NewTaskForm from './NewTaskForm'
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

  const allComments = await db.comment
    .findMany({
      where: { brandSpaceId: params.id, objectType: 'task' },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { name: true, email: true } } },
    })
    .catch(() => [])

  const commentsByTask = new Map<string, typeof allComments>()
  for (const c of allComments) {
    const list = commentsByTask.get(c.objectId) || []
    list.push(c)
    commentsByTask.set(c.objectId, list)
  }

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Tasks</div>
        <div className="topbar-sub">Simple jobs — tell us what you need, attach a file, done.</div>
      </div>

      <NewTaskForm brandSpaceId={params.id} assigneeOptions={Array.from(assigneeOptions.values())} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.length === 0 && <div className="card-empty">No tasks yet.</div>}
        {tasks.map((task) => (
          <TaskCard key={task.id} brandSpaceId={params.id} task={task} comments={commentsByTask.get(task.id) || []} />
        ))}
      </div>
    </div>
  )
}
