import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { setCanInvite, setMemberRole, removeMember, revokeInvite } from './actions'
import InviteLink from '../InviteLink'

const SERIF = "Georgia, 'Times New Roman', serif"
const small: React.CSSProperties = { padding: '3px 10px', fontSize: 12 }

export default async function PeoplePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role !== 'agency') notFound()
  const { brandSpace } = access

  const members = await db.brandSpaceAccess.findMany({ where: { brandSpaceId: params.id }, include: { user: true } }).catch(() => [])
  const invites = await db.brandSpaceInvite
    .findMany({ where: { brandSpaceId: params.id, revokedAt: null }, orderBy: { createdAt: 'desc' } })
    .catch(() => [])

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 22 }}>
        <div className="topbar-greeting">People &amp; permissions</div>
        <div className="topbar-sub">Who can open {brandSpace.name}, and who is allowed to invite others.</div>
      </div>

      <div className="card" style={{ marginBottom: 24, maxWidth: 420 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Invite someone</div>
        <InviteLink brandSpaceId={params.id} />
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Access</div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5, display: 'flex', gap: 10 }}>
          <span style={{ flex: 1 }}>You</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Owner · full control</span>
        </div>
        {members.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>No one else has access yet.</div>}
        {members.map((m) => {
          const isClient = m.role === 'client'
          return (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div>{m.user.name || m.user.email}</div>
                {m.user.name && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{m.user.email}</div>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 90 }}>{isClient ? 'Client' : 'Team member'}</span>
              {!isClient && (
                <form action={setCanInvite.bind(null, params.id, m.userId, !m.canInvite)}>
                  <button type="submit" style={{ ...small, borderColor: m.canInvite ? 'var(--accent)' : undefined }}>
                    Can invite: {m.canInvite ? 'On' : 'Off'}
                  </button>
                </form>
              )}
              <form action={setMemberRole.bind(null, params.id, m.userId, isClient ? 'team_member' : 'client')}>
                <button type="submit" style={small}>{isClient ? 'Make team member' : 'Make client'}</button>
              </form>
              <form action={removeMember.bind(null, params.id, m.userId)}>
                <button type="submit" style={small}>Remove</button>
              </form>
            </div>
          )
        })}
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Active invite links</div>
      <div style={{ marginBottom: 28 }}>
        {invites.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No active links. Create one above.</div>}
        {invites.map((i) => (
          <div key={i.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>{i.role === 'client' ? 'Client link' : 'Team member link'}</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>created {i.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
            <form action={revokeInvite.bind(null, params.id, i.id)}>
              <button type="submit" style={small}>Switch off</button>
            </form>
          </div>
        ))}
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Who can do what</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div><strong>Owner</strong> manages everything, including people, and can always invite.</div>
          <div><strong>Team member</strong> creates and edits boards, tasks, campaigns and projects. Cannot invite unless you switch &quot;Can invite&quot; on.</div>
          <div><strong>Client</strong> views and approves. Cannot edit, and never sees campaigns or projects.</div>
        </div>
      </div>
    </div>
  )
}
