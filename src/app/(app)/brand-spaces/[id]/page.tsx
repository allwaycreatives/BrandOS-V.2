import BrandDot from '@/components/BrandDot'
import SocialLinks from './SocialLinks'
import { parseSocial } from '@/lib/social'
import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import DiscoveryLink from './DiscoveryLink'
import InviteLink from './InviteLink'
import ShareBrandCard from './ShareBrandCard'
import ShareBriefCard from './ShareBriefCard'
import ClientItemRow from './ClientItemRow'
import ClampText from '@/components/ClampText'
import { brandColor } from '@/lib/brandColor'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import BrandFamilyCard from './BrandFamilyCard'
import FacesCard, { type FaceItem, type LinkedBrandItem } from './FacesCard'

const STATUS_LABELS: Record<string, string> = {
  open: 'Waiting to start',
  in_progress: 'Working on it',
  done: 'Done!',
  idea: 'Idea',
  planned: 'Planned',
  in_production: 'In production',
  scheduled: 'Scheduled',
  published: 'Published',
}

const SERIF = "Georgia, 'Times New Roman', serif"

function Tile({ href, label, value, caption, hot }: { href: string; label: string; value: string | number; caption: string; hot?: boolean }) {
  return (
    <Link href={href} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '14px 16px' }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, color: hot ? 'var(--accent-text)' : undefined }}>{value}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{caption}</span>
    </Link>
  )
}

export default async function BrandSpacePage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace, role, canInvite } = access

  const latestResponse = await db.discoveryResponse
    .findFirst({ where: { brandSpaceId: params.id }, orderBy: { submittedAt: 'desc' } })
    .catch(() => null)

  const responseCount = await db.discoveryResponse.count({ where: { brandSpaceId: params.id } }).catch(() => 0)
  const answers = (latestResponse?.answersJson as Record<string, string | string[]>) || {}

  const knownFor = typeof answers.known_for === 'string' ? answers.known_for : ''
  const audience = typeof answers.audience === 'string' ? answers.audience : ''
  const rawStyle = answers.brand_style
  const style = Array.isArray(rawStyle)
    ? rawStyle.length > 1
      ? `${rawStyle[0]} (primary) + ${rawStyle.slice(1).join(', ')}`
      : rawStyle[0] ?? ''
    : typeof rawStyle === 'string'
    ? rawStyle
    : ''
  const tones = Array.isArray(answers.tone_words) ? answers.tone_words : []
  const label: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }

  const brandSummaryCard = latestResponse ? (
    <div className="card" style={{ marginBottom: 28, padding: '22px 24px' }}>
      <div style={{ ...label, color: 'var(--accent-text)', fontWeight: 600, marginBottom: 12 }}>Brand identity</div>
      {knownFor && (
        <div style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.3, fontWeight: 600, marginBottom: 14 }}>
          <ClampText text={knownFor} limit={170} />
        </div>
      )}
      {tones.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {tones.map((t) => (
            <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
              {t}
            </span>
          ))}
        </div>
      )}
      {(audience || style) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          {audience && (
            <div>
              <div style={label}>Audience</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                <ClampText text={audience} limit={170} />
              </div>
            </div>
          )}
          {style && (
            <div>
              <div style={label}>Brand style</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                <ClampText text={style} limit={170} />
              </div>
            </div>
          )}
        </div>
      )}
      {role === 'agency' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16, fontSize: 12.5 }}>
          <Link href={`/brand-spaces/${params.id}/discovery`} style={{ color: 'var(--accent-text)' }}>
            View full discovery →
          </Link>
          <Link href={`/brand-spaces/${params.id}/discovery/template`} style={{ color: 'var(--text-secondary)' }}>
            Customize questions
          </Link>
        </div>
      )}
    </div>
  ) : role === 'client' ? (
    <div className="card-empty" style={{ marginBottom: 24 }}>No brand summary yet.</div>
  ) : (
    <div className="card" style={{ marginBottom: 28, padding: '22px 24px', borderColor: 'var(--accent-dim)' }}>
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Start with discovery</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 16, maxWidth: 520 }}>
        Send this short questionnaire to your client. They answer in a few minutes, with no login, and you get a clear brand summary right here.
      </div>
      <div style={{ maxWidth: 320 }}>
        <DiscoveryLink brandSpaceId={params.id} />
      </div>
    </div>
  )

  // ---- Client view: simple, with optional expand + comments ----
  if (role === 'client') {
    const tasks = await db.task
      .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } })
      .catch(() => [])
    const calendarItems = await db.calendarItem
      .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, take: 8 })
      .catch(() => [])

    const allComments = await db.comment
      .findMany({
        where: { brandSpaceId: params.id, objectType: { in: ['task', 'calendarItem'] } },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, email: true } } },
      })
      .catch(() => [])

    const commentsFor = (objectId: string) => allComments.filter((c) => c.objectId === objectId)

    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 20 }}>
          <div className="topbar-greeting">{brandSpace.name}</div>
          <div className="topbar-sub">Here's what we're working on for you.</div>
          <SocialLinks brandSpaceId={params.id} links={parseSocial(brandSpace.socialLinks)} canEdit={false} />
        </div>

        {brandSummaryCard}

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>What's happening</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Tap anything for more detail, or to leave a comment.
          </div>
          {tasks.length === 0 && calendarItems.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing yet — check back soon.</div>
          )}
          {tasks.map((t) => (
            <ClientItemRow
              key={t.id}
              brandSpaceId={params.id}
              objectType="task"
              objectId={t.id}
              title={t.title}
              statusLabel={STATUS_LABELS[t.status] || t.status}
              description={t.description}
              comments={commentsFor(t.id)}
            />
          ))}
          {calendarItems.map((c) => (
            <ClientItemRow
              key={c.id}
              brandSpaceId={params.id}
              objectType="calendarItem"
              objectId={c.id}
              title={c.title}
              subtitle={c.platform}
              statusLabel={STATUS_LABELS[c.status] || c.status}
              description={c.hook || c.keyMessage}
              comments={commentsFor(c.id)}
            />
          ))}
        </div>
      </div>
    )
  }

  // ---- Agency / team member view: brand command center ----
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const bs = { brandSpaceId: params.id }
  const [openTasks, activeCampaigns, activeProjects, waitingReviews, openIdeas, boardCount, calendarOpen, changeItems, overdueTasks] = await Promise.all([
    db.task.count({ where: { ...bs, status: { not: 'done' } } }).catch(() => 0),
    db.campaign.count({ where: { ...bs, status: { not: 'done' } } }).catch(() => 0),
    db.project.count({ where: { ...bs, status: { not: 'delivered' } } }).catch(() => 0),
    db.deliverable.count({ where: { ...bs, status: { in: ['in_review', 'changes_requested'] } } }).catch(() => 0),
    db.idea.count({ where: { ...bs, status: 'open' } }).catch(() => 0),
    db.board.count({ where: bs }).catch(() => 0),
    db.calendarItem.count({ where: { ...bs, status: { not: 'published' } } }).catch(() => 0),
    db.deliverable.findMany({ where: { ...bs, status: 'changes_requested' }, orderBy: { updatedAt: 'desc' }, take: 3, select: { id: true, title: true } }).catch(() => []),
    db.task.findMany({ where: { ...bs, status: { not: 'done' }, dueDate: { lt: startOfToday } }, orderBy: { dueDate: 'asc' }, take: 3, select: { id: true, title: true } }).catch(() => []),
  ])

  // Brand family: the shared brand this one belongs to, and any founder brands under it.
  const { user, organizationId } = await getOrCreateCurrentUser()
  const allBrands = await getUserBrands(user.id, organizationId)
  const parent = allBrands.find((b) => b.id === brandSpace.parentId)
  const children = allBrands.filter((b) => b.parentId === params.id)
  // A founder brand with no discovery of its own starts from the shared brand's identity.
  const inherited =
    !latestResponse && parent
      ? await db.discoveryResponse.findFirst({ where: { brandSpaceId: parent.id }, orderBy: { submittedAt: 'desc' } }).catch(() => null)
      : null
  const pa = (inherited?.answersJson as Record<string, string | string[]>) || {}
  const pKnown = typeof pa.known_for === 'string' ? pa.known_for : ''
  const pTones = Array.isArray(pa.tone_words) ? pa.tone_words : []
  const inheritedCard =
    parent && inherited && (pKnown || pTones.length > 0) ? (
      <div className="card" style={{ marginBottom: 28, padding: '22px 24px' }}>
        <div style={{ ...label, color: 'var(--accent-text)', fontWeight: 600, marginBottom: 12 }}>From {parent.name}</div>
        {pKnown && (
          <div style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.3, fontWeight: 600, marginBottom: 14 }}>
            <ClampText text={pKnown} limit={170} />
          </div>
        )}
        {pTones.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {pTones.map((t) => (
              <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 14, maxWidth: 560 }}>
          This is the shared brand&apos;s identity, shown as a starting point. Send {brandSpace.name} their own discovery link to capture their personal voice.
        </div>
        <div style={{ maxWidth: 320, marginBottom: 12 }}>
          <DiscoveryLink brandSpaceId={params.id} />
        </div>
        <Link href={`/brand-spaces/${parent.id}`} style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>View {parent.name} →</Link>
      </div>
    ) : null

  // The faces of a company brand. Brands linked under it with the older founder setup have no face
  // record, so they are shown too, without repeating anyone who is already listed as a face.
  const isCompany = !brandSpace.parentId
  const faceRows = isCompany ? await db.brandFace.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'asc' } }).catch(() => []) : []
  const usedChildIds = new Set<string>()
  const faceItems: FaceItem[] = faceRows.map((f) => {
    let brand = f.personalBrandId ? allBrands.find((b) => b.id === f.personalBrandId) : undefined
    if (!brand) {
      // A same-named linked brand that no face points at yet counts as this person's brand.
      brand = children.find((c) => !usedChildIds.has(c.id) && !faceRows.some((o) => o.personalBrandId === c.id) && c.name.trim().toLowerCase() === f.name.trim().toLowerCase())
    }
    if (brand) usedChildIds.add(brand.id)
    return { id: f.id, name: f.name, role: f.role, brand: brand ? { id: brand.id, color: brand.color } : null }
  })
  const extraBrands: LinkedBrandItem[] = children.filter((c) => !usedChildIds.has(c.id)).map((c) => ({ id: c.id, name: c.name, color: c.color }))
  const showFaces = isCompany && (role === 'agency' || faceItems.length > 0 || extraBrands.length > 0)

  const familyOptions = allBrands.filter((b) => b.role === 'owner' && b.id !== params.id && !b.parentId).map((b) => ({ id: b.id, name: b.name }))

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const summaryParts = [
    openTasks > 0 && plural(openTasks, 'open task', 'open tasks'),
    activeCampaigns > 0 && plural(activeCampaigns, 'active campaign', 'active campaigns'),
    activeProjects > 0 && plural(activeProjects, 'project in progress', 'projects in progress'),
    waitingReviews > 0 && `${waitingReviews} in review`,
  ].filter(Boolean)
  const base = `/brand-spaces/${params.id}`
  const attention = [
    ...changeItems.map((d) => ({ key: `d${d.id}`, tag: 'Changes requested', title: d.title, href: `${base}/reviews/${d.id}` })),
    ...overdueTasks.map((t) => ({ key: `t${t.id}`, tag: 'Overdue', title: t.title, href: `${base}/tasks` })),
  ]
  const showTeam = canInvite || role === 'agency'

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          {parent && (
            <Link href={`/brand-spaces/${parent.id}`} style={{ display: 'inline-block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Part of {parent.name}
            </Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandDot size={14} color={brandColor(brandSpace.name)} />
            <h1 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, margin: 0, lineHeight: 1.15 }}>{brandSpace.name}</h1>
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>
            {summaryParts.length > 0 ? summaryParts.join('  ·  ') : responseCount > 0 ? 'Nothing in progress yet. Add a task, project or campaign to get going.' : 'Nothing in progress yet. Start with discovery or add a task.'}
          </div>
          <SocialLinks brandSpaceId={params.id} links={parseSocial(brandSpace.socialLinks)} canEdit />
        </div>
      </div>

      {attention.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Needs attention</div>
          {attention.map((a) => (
            <Link key={a.key} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <span style={{ fontSize: 11.5, color: 'var(--accent-text)', minWidth: 110 }}>{a.tag}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
            </Link>
          ))}
        </div>
      )}

      {inheritedCard ?? brandSummaryCard}

      {showFaces && <FacesCard brandSpaceId={params.id} brandName={brandSpace.name} canEdit={role === 'agency'} faces={faceItems} extras={extraBrands} />}

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Work</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 12, marginBottom: 32 }}>
        <Tile href={`${base}/tasks`} label="Tasks" value={openTasks} caption={overdueTasks.length > 0 ? `${overdueTasks.length}+ overdue` : 'open'} hot={overdueTasks.length > 0} />
        <Tile href={`${base}/campaigns`} label="Campaigns" value={activeCampaigns} caption="active" />
        <Tile href={`${base}/projects`} label="Projects" value={activeProjects} caption="in progress" />
        <Tile href={`${base}/reviews`} label="Reviews" value={waitingReviews} caption={changeItems.length > 0 ? `${changeItems.length} with changes` : 'out with clients'} hot={changeItems.length > 0} />
        <Tile href={`${base}/ideas`} label="Ideas" value={openIdeas} caption="parked" />
        <Tile href={`${base}/calendar`} label="Calendar" value={calendarOpen} caption="content to publish" />
        <Tile href={`${base}/boards`} label="Boards" value={boardCount} caption="moodboards and plans" />
        <Tile href={`${base}/brand-kit`} label="Brand kit" value="Open" caption={responseCount > 0 ? 'bio and tagline options' : 'after discovery'} />
      </div>

      {showTeam && (
        <>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Team &amp; sharing</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
            {canInvite && (
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Invite someone</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                  Give a client or team member access to this brand. Invite a hands-on client as &quot;Team member&quot; to give them the full toolset.
                </div>
                <InviteLink brandSpaceId={params.id} />
              </div>
            )}
            {role === 'agency' && <ShareBrandCard brandSpaceId={params.id} shareToken={brandSpace.shareToken} />}
            {role === 'agency' && children.length === 0 && (familyOptions.length > 0 || brandSpace.parentId) && (
              <BrandFamilyCard brandSpaceId={params.id} parentId={brandSpace.parentId} options={familyOptions} />
            )}
            {role === 'agency' && <ShareBriefCard brandSpaceId={params.id} brandName={brandSpace.name} intakeToken={brandSpace.intakeToken} />}
            {role === 'agency' && responseCount > 0 && (
              <div className="card">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Discovery link</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {plural(responseCount, 'response', 'responses')} so far. Send the link again to collect more.
                </div>
                <DiscoveryLink brandSpaceId={params.id} />
              </div>
            )}
            {role === 'agency' && (
              <Link href={`${base}/people`} className="card">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>People &amp; permissions</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  See who has access, choose who can invite others, and switch off invite links.
                </div>
              </Link>
            )}
          </div>
        </>
      )}

      {role === 'agency' && (
        <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Link href={`${base}/delete`} style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Delete this brand…</Link>
        </div>
      )}
    </div>
  )
}
