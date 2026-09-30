import { db } from './db'

// How far along each campaign is: published content out of all content.
export async function getCampaignProgress(campaignIds: string[]) {
  const map = new Map<string, { total: number; published: number }>()
  if (campaignIds.length === 0) return map
  const rows = await db.calendarItem
    .groupBy({ by: ['campaignId', 'status'], where: { campaignId: { in: campaignIds } }, _count: { _all: true } })
    .catch(() => [])
  for (const r of rows) {
    if (!r.campaignId) continue
    const cur = map.get(r.campaignId) ?? { total: 0, published: 0 }
    cur.total += r._count._all
    if (r.status === 'published') cur.published += r._count._all
    map.set(r.campaignId, cur)
  }
  return map
}
