import { db } from './db'
import { brandColor } from './brandColor'

export { brandColor }

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
