import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import DiscoveryLink from './DiscoveryLink'
import InviteLink from './InviteLink'

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

export default async function BrandSpacePage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace, role } = access

  const latestResponse = await db.discoveryResponse
    .findFirst({ where: { brandSpaceId: params.id }, orderBy: { submittedAt: 'desc' } })
    .catch(() => null)

  const responseCount = await db.discoveryResponse.count({ where: { brandSpaceId: params.id } }).catch(() => 0)
  const answers = (latestResponse?.answersJson as Record<string, string | string[]>) || {}

  const brandSummaryCard = latestResponse ? (
    <div className="card" style={{ marginBottom: 24, borderColor: 'var(--border-strong)' }}>
      <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 }}>
        Brand Summary
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {answers.known_for && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Known for</div>
            <div style={{ fontSize: 13.5 }}>{answers.known_for as string}</div>
          </div>
        )}
        {answers.audience && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Audience</div>
            <div style={{ fontSize: 13.5 }}>{answers.audience as string}</div>
          </div>
        )}
        {answers.brand_style && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Brand style</div>
            <div style={{ fontSize: 13.5 }}>
              {Array.isArray(answers.brand_style)
                ? answers.brand_style.length > 1
                  ? `${answers.brand_style[0]} (primary) + ${answers.brand_style.slice(1).join(', ')}`
                  : answers.brand_style[0]
                : answers.brand_style}
            </div>
          </div>
        )}
        {Array.isArray(answers.tone_words) && answers.tone_words.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>Tone</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {answers.tone_words.map((t) => (
                <span key={t} style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {role === 'agency' && (
        <Link href={`/brand-spaces/${params.id}/discovery`} style={{ fontSize: 12, color: 'var(--accent)', display: 'inline-block', marginTop: 12 }}>
          View full discovery →
        </Link>
      )}
    </div>
  ) : (
    <div className="card-empty" style={{ marginBottom: 24 }}>
      No brand summary yet{role === 'agency' ? ' — send the discovery link below to get one.' : '.'}
    </div>
  )

  // ---- Client view: simple, read-only, no tools to tinker with ----
  if (role === 'client') {
    const tasks = await db.task
      .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } })
      .catch(() => [])
    const calendarItems = await db.calendarItem
      .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, take: 8 })
      .catch(() => [])

    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 20 }}>
          <div className="topbar-greeting">{brandSpace.name}</div>
          <div className="topbar-sub">Here's what we're working on for you.</div>
        </div>

        {brandSummaryCard}

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>What's happening</div>
          {tasks.length === 0 && calendarItems.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing yet — check back soon.</div>
          )}
          {tasks.map((t) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <span>{t.title}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{STATUS_LABELS[t.status] || t.status}</span>
            </div>
          ))}
          {calendarItems.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
              <span>{c.title} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({c.platform})</span></span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{STATUS_LABELS[c.status] || c.status}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---- Agency / team member view: full toolset ----
  return (
    <div>
      <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← All brand spaces</Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">{brandSpace.name}</div>
        <div className="topbar-sub">This brand space's home.</div>
      </div>

      {brandSummaryCard}

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
            <Link href={`/brand-spaces/${params.id}/discovery/template`}>
              <button style={{ width: '100%', fontSize: 12 }}>Customize questionnaire</button>
            </Link>
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
            Give a client or team member access to just this brand space. Want a hands-on client to see the full toolset instead of the simple view? Invite them as "Team member" rather than "Client."
          </div>
          <InviteLink brandSpaceId={params.id} />
        </div>
      </div>
    </div>
  )
}
