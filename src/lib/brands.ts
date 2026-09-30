import { db } from './db'

const PALETTE = ['#EF9F27', '#1D9E75', '#7F77DD', '#D85A30', '#378ADD', '#D4537E', '#639922']

// Brands have no colour field yet, so each one gets a stable colour from its name.
export function brandColor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export type BrandSummary = {
  id: string
  name: string
  role: 'owner' | 'team_member' | 'client'
  color: string
}

// Every brand the person can open: ones in their own workspace, plus ones they were invited to.
export async function getUserBrands(userId: string, organizationId: string): Promise<BrandSummary[]> {
  const owned = await db.brandSpace
    .findMany({ where: { organizationId }, select: { id: true, name: true } })
    .catch(() => [])
  const invited = await db.brandSpaceAccess
    .findMany({ where: { userId }, include: { brandSpace: { select: { id: true, name: true } } } })
    .catch(() => [])

  const list: BrandSummary[] = owned.map((b) => ({ ...b, role: 'owner' as const, color: brandColor(b.name) }))
  for (const a of invited) {
    if (list.some((b) => b.id === a.brandSpace.id)) continue
    list.push({
      id: a.brandSpace.id,
      name: a.brandSpace.name,
      role: a.role === 'client' ? 'client' : 'team_member',
      color: brandColor(a.brandSpace.name),
    })
  }
  return list
}
