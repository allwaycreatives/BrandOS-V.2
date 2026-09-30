import { db } from './db'

// How many of each project's tasks are done.
export async function getProjectProgress(projectIds: string[]) {
  const map = new Map<string, { total: number; done: number }>()
  if (projectIds.length === 0) return map
  const rows = await db.task
    .groupBy({ by: ['projectId', 'status'], where: { projectId: { in: projectIds } }, _count: { _all: true } })
    .catch(() => [])
  for (const r of rows) {
    if (!r.projectId) continue
    const cur = map.get(r.projectId) ?? { total: 0, done: 0 }
    cur.total += r._count._all
    if (r.status === 'done') cur.done += r._count._all
    map.set(r.projectId, cur)
  }
  return map
}
