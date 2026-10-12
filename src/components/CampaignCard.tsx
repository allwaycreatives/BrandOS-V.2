import BrandDot from '@/components/BrandDot'
import Link from 'next/link'
import { STATUS_LABEL } from '@/app/(app)/brand-spaces/[id]/campaigns/constants'

export default function CampaignCard({
  campaign,
  brand,
  progress,
}: {
  campaign: { id: string; brandSpaceId: string; name: string; status: string; goal: string | null }
  brand: { name: string; color: string }
  progress: { total: number; published: number }
}) {
  const pct = progress.total ? Math.round((progress.published / progress.total) * 100) : 0
  return (
    <Link href={`/brand-spaces/${campaign.brandSpaceId}/campaigns/${campaign.id}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
        <BrandDot size={8} color={brand.color} />
        <span style={{ flex: 1 }}>{brand.name}</span>
        <span>{STATUS_LABEL[campaign.status] ?? campaign.status}</span>
      </div>
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600, fontSize: 16 }}>{campaign.name}</div>
      {campaign.goal && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{campaign.goal}</div>}
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        {progress.total === 0 ? 'No content yet' : `${progress.published} of ${progress.total} published`}
      </div>
    </Link>
  )
}
