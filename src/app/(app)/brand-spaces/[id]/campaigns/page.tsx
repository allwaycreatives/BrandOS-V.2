import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { brandColor } from '@/lib/brands'
import { getCampaignProgress } from '@/lib/campaigns'
import { createCampaign } from './actions'
import CampaignCard from '@/components/CampaignCard'

export default async function BrandCampaignsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()
  const { brandSpace } = access

  const campaigns = await db.campaign.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } }).catch(() => [])
  const progress = await getCampaignProgress(campaigns.map((c) => c.id))
  const brand = { name: brandSpace.name, color: brandColor(brandSpace.name) }

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Campaigns</div>
        <div className="topbar-sub">One push at a time, from idea to posted. Duplicate a campaign that worked to start the next one.</div>
      </div>

      <form action={createCampaign} className="card" style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <input type="hidden" name="brandSpaceId" value={params.id} />
        <input name="name" required placeholder="New campaign, e.g. Summer launch" style={{ flex: 1, minWidth: 200 }} />
        <input name="goal" placeholder="Goal (optional)" style={{ flex: 1, minWidth: 200 }} />
        <button className="primary" type="submit">Create campaign</button>
      </form>

      {campaigns.length === 0 ? (
        <div className="card-empty">No campaigns yet. Create one above, or start from the Campaign plan template on the Boards page.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} brand={brand} progress={progress.get(c.id) ?? { total: 0, published: 0 }} />
          ))}
        </div>
      )}
    </div>
  )
}
