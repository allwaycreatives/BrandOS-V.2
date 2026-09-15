import { db } from '@/lib/db'
import AcceptInviteButton from './AcceptInviteButton'

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { brandSpaceId: string }
  searchParams: { role?: string }
}) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.brandSpaceId } }).catch(() => null)

  if (!brandSpace) {
    return (
      <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <div className="card">This invite link isn't valid.</div>
      </main>
    )
  }

  const role = searchParams.role === 'client' ? 'client' : 'team_member'

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', padding: '0 1rem' }}>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>You've been invited to {brandSpace.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
          Role: {role === 'client' ? 'Client (view & approve)' : 'Team member'}
        </div>
        <AcceptInviteButton brandSpaceId={brandSpace.id} role={role} />
      </div>
    </main>
  )
}
