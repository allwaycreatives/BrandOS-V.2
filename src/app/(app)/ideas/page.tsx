import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import IdeaList from '@/components/IdeaList'

export default async function AllIdeasPage() {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')
  const ideas = brands.length
    ? await db.idea.findMany({ where: { brandSpaceId: { in: brands.map((b) => b.id) }, status: 'open' }, orderBy: { createdAt: 'desc' } }).catch(() => [])
    : []

  return (
    <div>
      <div className="topbar-greeting">Ideas</div>
      <div className="topbar-sub" style={{ marginBottom: 20 }}>Park an idea the moment you have it. When it is ready, turn it into a campaign or project in one click.</div>
      <IdeaList ideas={ideas} brands={brands} />
    </div>
  )
}
