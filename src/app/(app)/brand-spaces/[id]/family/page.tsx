import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import { STAGES, PLATFORMS } from '../campaigns/constants'

const SERIF = "Georgia, 'Times New Roman', serif"

// Who is posting what, where: the shared brand and its founders side by side.
export default async function FamilyPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()

  const { user, organizationId } = await getOrCreateCurrentUser()
  const all = await getUserBrands(user.id, organizationId)
  const me = all.find((b) => b.id === params.id)
  const rootId = me?.parentId && all.some((b) => b.id === me.parentId) ? me.parentId : params.id
  const root = all.find((b) => b.id === rootId)
  const members = [root, ...all.filter((b) => b.parentId === rootId)].filter((b): b is NonNullable<typeof b> => !!b && b.role !== 'client')

  if (!root || members.length < 2) {
    return (
      <div>
        <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← Back</Link>
        <div className="topbar-greeting" style={{ marginTop: 8 }}>Family</div>
        <div className="card-empty" style={{ marginTop: 16 }}>
          This brand has no linked brands yet. Use the founder setup, or the Brand family card on a brand&apos;s overview, to link founders to a shared brand.
        </div>
      </div>
    )
  }

  const items = await db.calendarItem
    .findMany({
      where: { brandSpaceId: { in: members.map((m) => m.id) } },
      select: { id: true, title: true, platform: true, status: true, brandSpaceId: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    })
    .catch(() => [])

  const platforms = Array.from(new Set([...PLATFORMS, ...items.map((i) => i.platform)]))
  const count = new Map<string, number>()
  for (const it of items) {
    const key = `${it.platform}|${it.brandSpaceId}`
    count.set(key, (count.get(key) ?? 0) + 1)
  }
  const brandOf = new Map(members.map((m) => [m.id, m]))
  const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', padding: '8px 10px', borderBottom: '1px solid var(--border-strong)' }
  const td: React.CSSProperties = { padding: '10px', borderBottom: '1px solid var(--border)', fontSize: 13.5 }

  return (
    <div>
      <Link href={`/brand-spaces/${root.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← {root.name}</Link>
      <div style={{ marginTop: 8, marginBottom: 22 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, margin: 0 }}>{root.name} family</h1>
        <div className="topbar-sub">The shared brand and its founders side by side, so you can see who is posting what, and where.</div>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Posting map</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
        Planned and published content by platform. A founder with a lot on a platform the shared brand also covers may be doubling up.
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 32 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
          <thead>
            <tr>
              <th style={th}>Platform</th>
              {members.map((m) => (
                <th key={m.id} style={th}>
                  <Link href={`/brand-spaces/${m.id}/calendar`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
                    {m.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((pl) => (
              <tr key={pl}>
                <td style={{ ...td, fontWeight: 600 }}>{pl}</td>
                {members.map((m) => {
                  const n = count.get(`${pl}|${m.id}`) ?? 0
                  return (
                    <td key={m.id} style={td}>
                      {n > 0 ? (
                        <span style={{ display: 'inline-block', minWidth: 28, textAlign: 'center', padding: '2px 8px', borderRadius: 999, background: 'var(--accent-dim)', color: 'var(--accent-text)', fontWeight: 600, fontSize: 12.5 }}>{n}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Content pipeline across the family</div>
      {items.length === 0 ? (
        <div className="card-empty">No content planned yet. Add content on each brand&apos;s Calendar and it shows up here.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 12 }}>
          {STAGES.map((stage) => {
            const col = items.filter((i) => i.status === stage.key)
            return (
              <div key={stage.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, minHeight: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {stage.label} ({col.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing here</div>}
                  {col.slice(0, 8).map((it) => {
                    const b = brandOf.get(it.brandSpaceId)
                    return (
                      <Link key={it.id} href={`/brand-spaces/${it.brandSpaceId}/calendar`} style={{ display: 'block', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{it.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: b?.color }} />
                          {b?.name} · {it.platform}
                        </div>
                      </Link>
                    )
                  })}
                  {col.length > 8 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{col.length - 8} more</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
