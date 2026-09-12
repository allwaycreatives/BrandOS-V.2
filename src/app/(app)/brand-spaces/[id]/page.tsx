import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import DiscoveryLink from './DiscoveryLink'

async function getBrandSpace(id: string) {
  try {
    return await db.brandSpace.findUnique({ where: { id } })
  } catch {
    return null
  }
}

const upcomingSections = [
  { title: 'Brand Kit', description: 'AI-generated bio, tagline, and palette options once discovery is done.' },
  { title: 'Calendar', description: 'Plan and track content by platform and status.' },
  { title: 'Boards', description: 'A freeform canvas for moodboards and campaign ideas.' },
]

export default async function BrandSpacePage({ params }: { params: { id: string } }) {
  const brandSpace = await getBrandSpace(params.id)

  if (!brandSpace) {
    notFound()
  }

  const responseCount = await db.discoveryResponse.count({ where: { brandSpaceId: params.id } }).catch(() => 0)

  return (
    <div>
      <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← All brand spaces</Link>

      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div className="topbar-greeting">{brandSpace!.name}</div>
        <div className="topbar-sub">This brand space's home — more sections activate as we build them.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Discovery</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {responseCount > 0
              ? `${responseCount} response${responseCount === 1 ? '' : 's'} received.`
              : 'Send this link to your client — no login needed on their end.'}
          </div>
          <DiscoveryLink brandSpaceId={params.id} />
        </div>

        {upcomingSections.map((section) => (
          <div key={section.title} className="card" style={{ opacity: 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{section.title}</div>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 999, padding: '1px 6px', textTransform: 'uppercase' }}>Soon</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{section.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
