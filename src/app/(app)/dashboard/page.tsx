import { db } from '@/lib/db'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { createBrandSpace } from '../../actions'

export default async function DashboardPage() {
  const { user, organizationId } = await getOrCreateCurrentUser()

  const ownedSpaces = await db.brandSpace
    .findMany({ where: { organizationId }, select: { id: true, name: true } })
    .catch(() => [])

  const invitedAccess = await db.brandSpaceAccess
    .findMany({ where: { userId: user.id }, include: { brandSpace: { select: { id: true, name: true } } } })
    .catch(() => [])

  const invitedSpaces = invitedAccess
    .map((a) => a.brandSpace)
    .filter((bs) => !ownedSpaces.some((o) => o.id === bs.id))

  const brandSpaces = [...ownedSpaces, ...invitedSpaces]

  // A client-only account: never created a brand space of their own, and
  // every invite they have is specifically as a client, not a team member.
  // They shouldn't see brand-space creation at all.
  const isClientOnly =
    ownedSpaces.length === 0 &&
    invitedAccess.length > 0 &&
    invitedAccess.every((a) => a.role === 'client')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="topbar-greeting">{isClientOnly ? 'Your brand' : 'Your brand spaces'}</div>
          <div className="topbar-sub">{isClientOnly ? "What we're working on together." : "Everything you're managing, in one place."}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isClientOnly && (
            <form action={createBrandSpace} style={{ display: 'flex', gap: 8 }}>
              <input name="name" required placeholder="Brand or client name" />
              <button className="primary" type="submit">Create</button>
            </form>
          )}
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {brandSpaces.length === 0 && (
          <div className="card-empty">No brand spaces yet — create your first one above.</div>
        )}
        {brandSpaces.map((bs) => (
          <Link key={bs.id} href={`/brand-spaces/${bs.id}`} className="card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{bs.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>Open to view calendar and brand kit</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
