import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import DiscoveryLink from './DiscoveryLink'
import InviteLink from './InviteLink'

export default async function BrandSpacePage({ params }: { params: { id: string } }) {
  const brandSpace = await assertBrandSpaceAccess(params.id)

  if (!brandSpace) {
    notFound()
  }

  const responseCount = await db.discoveryResponse.count({ where: { brandSpaceId: params.id } }).catch(() => 0)

  return (
    <div>
      <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← All brand spaces</Link>

      <div style={{ marginTop: 8, marginBottom: 24 }}>
        <div className="topbar-greeting">{brandSpace!.name}</div>
        <div className="topbar-sub">This brand space's home.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Discovery</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {responseCount > 0
              ? `${responseCount} response${responseCount === 1 ? '' : 's'} received.`
              : 'Send this link to your client — no login needed on their end.'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <DiscoveryLink brandSpaceId={params.id} />
            {responseCount > 0 && (
              <Link href={`/brand-spaces/${params.id}/discovery`}>
                <button style={{ width: '100%' }}>View responses</button>
              </Link>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Brand Kit</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {responseCount > 0 ? 'Generate bio and tagline options.' : 'Available once discovery is complete.'}
          </div>
          <Link href={`/brand-spaces/${params.id}/brand-kit`}>
            <button className="primary" style={{ width: '100%' }}>Open Brand Kit</button>
          </Link>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Calendar</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Plan content and move it through production.
          </div>
          <Link href={`/brand-spaces/${params.id}/calendar`}>
            <button className="primary" style={{ width: '100%' }}>Open Calendar</button>
          </Link>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Boards</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            A freeform canvas for moodboards and campaign ideas.
          </div>
          <Link href={`/brand-spaces/${params.id}/boards`}>
            <button className="primary" style={{ width: '100%' }}>Open Boards</button>
          </Link>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Tasks</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Quick jobs — no discovery required. Assign, attach a file, track status.
          </div>
          <Link href={`/brand-spaces/${params.id}/tasks`}>
            <button className="primary" style={{ width: '100%' }}>Open Tasks</button>
          </Link>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Notion</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            View a connected Notion page right here.
          </div>
          <Link href={`/brand-spaces/${params.id}/notion`}>
            <button className="primary" style={{ width: '100%' }}>Open Notion</button>
          </Link>
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Invite someone</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Give a client or team member access to just this brand space.
          </div>
          <InviteLink brandSpaceId={params.id} />
        </div>
      </div>
    </div>
  )
}
