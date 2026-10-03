import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import { getCampaignProgress } from '@/lib/campaigns'
import { createCampaign } from '../brand-spaces/[id]/campaigns/actions'
import CampaignCard from '@/components/CampaignCard'

const ORDER = ['live', 'planning', 'done']
const HEADING: Record<string, string> = { live: 'Live', planning: 'Planning', done: 'Done' }

export default async function AllCampaignsPage() {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')
  const brandById = new Map(brands.map((b) => [b.id, b]))

  const campaigns = brands.length
    ? await db.campaign.findMany({ where: { brandSpaceId: { in: brands.map((b) => b.id) } }, orderBy: { createdAt: 'desc' } }).catch(() => [])
    : []
  const progress = await getCampaignProgress(campaigns.map((c) => c.id))

  return (
    <div>
      <div className="topbar-greeting">Campaigns</div>
      <div className="topbar-sub" style={{ marginBottom: 20 }}>Every campaign across your brands, from idea to posted.</div>

      {brands.length > 0 ? (
        <form action={createCampaign} className="card" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <input name="name" required placeholder="New campaign, e.g. Summer launch" style={{ flex: 1, minWidth: 200 }} />
          <select name="brandSpaceId" defaultValue={brands[0].id}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button className="primary" type="submit">Create campaign</button>
        </form>
      ) : (
        <div className="card-empty" style={{ marginBottom: 24 }}>Create a brand first, then plan campaigns for it.</div>
      )}

      {ORDER.map((status) => {
        const list = campaigns.filter((c) => c.status === status)
        if (list.length === 0) return null
        return (
          <div key={status} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{HEADING[status]} · {list.length}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
              {list.map((c) => (
                <CampaignCard key={c.id} campaign={c} brand={brandById.get(c.brandSpaceId)!} progress={progress.get(c.id) ?? { total: 0, published: 0 }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
