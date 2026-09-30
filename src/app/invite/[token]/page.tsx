import { db } from '@/lib/db'
import AcceptInviteButton from './AcceptInviteButton'

export default async function InvitePage({ params }: { params: { token: string } }) {
  const invite = await db.brandSpaceInvite
    .findUnique({ where: { token: params.token }, include: { brandSpace: true } })
    .catch(() => null)

  if (!invite || invite.revokedAt) {
    return (
      <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <div className="card">This invite link isn't valid anymore. Ask the person who sent it for a new one.</div>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 420, margin: '4rem auto', textAlign: 'center', padding: '0 1rem' }}>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>You've been invited to {invite.brandSpace.name}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
          Role: {invite.role === 'client' ? 'Client (view & approve)' : 'Team member'}
        </div>
        <AcceptInviteButton token={invite.token} />
      </div>
    </main>
  )
}
