import { db } from './db'
import { dayKey, parseDay } from './plan'

export type AgendaPost = { id: string; brandId: string; title: string; platform: string; status: string; date: string; time: string | null }
export type AgendaShoot = { brandId: string; date: string; count: number }

// What is happening across brands between two days (from inclusive, to exclusive): posts going out, and shoot days.
export async function getAgenda(brandIds: string[], from: string, to: string): Promise<{ posts: AgendaPost[]; shoots: AgendaShoot[] }> {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b || brandIds.length === 0) return { posts: [], shoots: [] }

  const rows = await db.calendarItem
    .findMany({
      where: { brandSpaceId: { in: brandIds }, OR: [{ scheduledDate: { gte: a, lt: b } }, { productionDate: { gte: a, lt: b } }] },
      select: { id: true, brandSpaceId: true, title: true, platform: true, status: true, scheduledDate: true, productionDate: true, publishTime: true },
    })
    .catch(() => [])

  const posts: AgendaPost[] = []
  const shootCount = new Map<string, number>()
  for (const r of rows) {
    if (r.scheduledDate && r.scheduledDate >= a && r.scheduledDate < b) {
      posts.push({ id: r.id, brandId: r.brandSpaceId, title: r.title, platform: r.platform, status: r.status, date: dayKey(r.scheduledDate), time: r.publishTime })
    }
    if (r.productionDate && r.productionDate >= a && r.productionDate < b) {
      const k = `${r.brandSpaceId}|${dayKey(r.productionDate)}`
      shootCount.set(k, (shootCount.get(k) ?? 0) + 1)
    }
  }
  posts.sort((x, y) => x.date.localeCompare(y.date) || (x.time ?? '99:99').localeCompare(y.time ?? '99:99') || x.title.localeCompare(y.title))
  const shoots = Array.from(shootCount, ([k, count]) => {
    const [brandId, date] = k.split('|')
    return { brandId, date, count }
  })
  return { posts, shoots }
}
