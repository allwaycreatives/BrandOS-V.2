import BrandDot from '@/components/BrandDot'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import TaskRow from '@/components/TaskRow'

export default async function MyTasksPage(props: { searchParams: Promise<{ brand?: string }> }) {
  const searchParams = await props.searchParams;
  const { user, organizationId } = await getOrCreateCurrentUser()
  // Clients only view and approve, so they have no task list here.
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')
  const active = brands.find((b) => b.id === searchParams.brand)
  const shown = active ? [active] : brands

  const tasks = shown.length
    ? await db.task
        .findMany({
          where: { brandSpaceId: { in: shown.map((b) => b.id) }, status: { not: 'done' } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        })
        .catch(() => [])
    : []

  const brandById = new Map(brands.map((b) => [b.id, b]))
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  const groups = [
    { label: 'Overdue', items: tasks.filter((t) => t.dueDate && t.dueDate < startOfToday), overdue: true },
    { label: 'Today', items: tasks.filter((t) => t.dueDate && t.dueDate >= startOfToday && t.dueDate < endOfToday) },
    { label: 'Upcoming', items: tasks.filter((t) => t.dueDate && t.dueDate >= endOfToday) },
    { label: 'No due date', items: tasks.filter((t) => !t.dueDate) },
  ].filter((g) => g.items.length > 0)

  return (
    <div>
      <div className="topbar-greeting">My tasks</div>
      <div className="topbar-sub" style={{ marginBottom: 16 }}>Everything open, across all your brands.</div>

      {brands.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <Link href="/tasks" className="card" style={{ padding: '6px 12px', fontSize: 12.5, borderColor: !active ? 'var(--accent)' : undefined }}>
            All brands
          </Link>
          {brands.map((b) => (
            <Link
              key={b.id}
              href={`/tasks?brand=${b.id}`}
              className="card"
              style={{ padding: '6px 12px', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6, borderColor: active?.id === b.id ? 'var(--accent)' : undefined }}
            >
              <BrandDot size={8} color={b.color} />
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {groups.length === 0 && (
        <div className="card-empty">
          {brands.length === 0 ? 'Create a brand first, then add tasks to it.' : 'Nothing open. Add a task from Home, or open a brand to plan the next one.'}
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
            {g.label} · {g.items.length}
          </div>
          {g.items.map((t) => (
            <TaskRow key={t.id} title={t.title} status={t.status} dueDate={t.dueDate} brand={brandById.get(t.brandSpaceId)!} overdue={g.overdue} />
          ))}
        </div>
      ))}
    </div>
  )
}
