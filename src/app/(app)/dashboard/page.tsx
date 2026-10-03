import Link from 'next/link'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import { createBrandSpace, quickCreateTask } from '../../actions'
import { createCampaign } from '../brand-spaces/[id]/campaigns/actions'
import { getCampaignProgress } from '@/lib/campaigns'
import CampaignCard from '@/components/CampaignCard'
import ProjectCard from '@/components/ProjectCard'
import { createIdea } from '../brand-spaces/[id]/ideas/actions'
import { createProject } from '../brand-spaces/[id]/projects/actions'
import { getProjectProgress } from '@/lib/projects'
import TaskRow from '@/components/TaskRow'
import FirstRun from '@/components/FirstRun'
import { TEMPLATE_LIST } from '../brand-spaces/[id]/boards/templates'

const ROLE_LABEL = { owner: 'Your brand', team_member: 'Team member', client: 'Client' } as const

export default async function HomePage() {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = await getUserBrands(user.id, organizationId)
  const workBrands = brands.filter((b) => b.role !== 'client')
  const isClientOnly = brands.length > 0 && workBrands.length === 0
  const firstName = user.name?.split(' ')[0]

  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const dueSoon = workBrands.length
    ? await db.task
        .findMany({
          where: { brandSpaceId: { in: workBrands.map((b) => b.id) }, status: { not: 'done' }, dueDate: { not: null, lte: weekAhead } },
          orderBy: { dueDate: 'asc' },
          take: 6,
        })
        .catch(() => [])
    : []

  const openCounts = workBrands.length
    ? await db.task
        .groupBy({ by: ['brandSpaceId'], where: { brandSpaceId: { in: workBrands.map((b) => b.id) }, status: { not: 'done' } }, _count: { _all: true } })
        .catch(() => [])
    : []
  const activeCampaigns = workBrands.length
    ? await db.campaign
        .findMany({ where: { brandSpaceId: { in: workBrands.map((b) => b.id) }, status: { not: 'done' } }, orderBy: { createdAt: 'desc' }, take: 4 })
        .catch(() => [])
    : []
  const campaignProgress = await getCampaignProgress(activeCampaigns.map((c) => c.id))
  const activeProjects = workBrands.length
    ? await db.project
        .findMany({ where: { brandSpaceId: { in: workBrands.map((b) => b.id) }, status: { not: 'delivered' } }, orderBy: { createdAt: 'desc' }, take: 4 })
        .catch(() => [])
    : []
  const projectProgress = await getProjectProgress(activeProjects.map((p) => p.id))
  const reviewItems = workBrands.length
    ? await db.deliverable
        .findMany({
          where: { brandSpaceId: { in: workBrands.map((b) => b.id) }, status: { in: ['in_review', 'changes_requested'] } },
          orderBy: { updatedAt: 'desc' },
          take: 6,
        })
        .catch(() => [])
    : []
  const openByBrand = new Map(openCounts.map((c) => [c.brandSpaceId, c._count._all]))
  const brandById = new Map(brands.map((b) => [b.id, b]))
  const totalOpen = openCounts.reduce((n, c) => n + c._count._all, 0)

  const sub = isClientOnly
    ? "What we're working on together."
    : brands.length === 0
    ? "Let's set up your first brand."
    : dueSoon.length > 0
    ? `${dueSoon.length} ${dueSoon.length === 1 ? 'task needs' : 'tasks need'} you this week.`
    : totalOpen > 0
    ? `${totalOpen} open ${totalOpen === 1 ? 'task' : 'tasks'}, none due this week.`
    : 'You are all caught up.'

  return (
    <div>
      <div className="topbar-greeting">{firstName ? `Welcome back, ${firstName}` : 'Welcome back'}</div>
      <div className="topbar-sub" style={{ marginBottom: 22 }}>{sub}</div>

      {!isClientOnly && brands.length === 0 && <FirstRun templates={TEMPLATE_LIST} />}

      {!isClientOnly && brands.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12, marginBottom: 28 }}>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>New task</div>
            <form action={quickCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name="title" required placeholder="Edit the launch reel" />
              <div style={{ display: 'flex', gap: 8 }}>
                <select name="brandSpaceId" defaultValue={workBrands[0]?.id} style={{ flex: 1 }}>
                  {workBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button className="primary" type="submit">Add task</button>
              </div>
            </form>
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>Park an idea</div>
            <form action={createIdea} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name="title" required placeholder="Behind-the-scenes series" />
              <div style={{ display: 'flex', gap: 8 }}>
                <select name="brandSpaceId" defaultValue={workBrands[0]?.id} style={{ flex: 1 }}>
                  {workBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button type="submit">Save</button>
              </div>
            </form>
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>New campaign</div>
            <form action={createCampaign} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name="name" required placeholder="Summer launch" />
              <div style={{ display: 'flex', gap: 8 }}>
                <select name="brandSpaceId" defaultValue={workBrands[0]?.id} style={{ flex: 1 }}>
                  {workBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button className="primary" type="submit">Create</button>
              </div>
            </form>
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>New project</div>
            <form action={createProject} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input name="name" required placeholder="Brand film" />
              <div style={{ display: 'flex', gap: 8 }}>
                <select name="brandSpaceId" defaultValue={workBrands[0]?.id} style={{ flex: 1 }}>
                  {workBrands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button className="primary" type="submit">Create</button>
              </div>
            </form>
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13.5 }}>New brand</div>
            <form action={createBrandSpace} style={{ display: 'flex', gap: 8 }}>
              <input name="name" required placeholder="Brand or client name" style={{ flex: 1 }} />
              <button type="submit">Create</button>
            </form>
          </div>
        </div>
      )}

      {!isClientOnly && dueSoon.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Needs you</div>
            <Link href="/tasks" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>See all tasks</Link>
          </div>
          {dueSoon.map((t) => (
            <TaskRow
              key={t.id}
              title={t.title}
              status={t.status}
              dueDate={t.dueDate}
              brand={brandById.get(t.brandSpaceId)!}
              overdue={!!t.dueDate && t.dueDate < startOfToday}
            />
          ))}
        </div>
      )}

      {!isClientOnly && reviewItems.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Reviews</div>
          {reviewItems.map((r) => {
            const b = brandById.get(r.brandSpaceId)
            const changes = r.status === 'changes_requested'
            return (
              <Link key={r.id} href={`/brand-spaces/${r.brandSpaceId}/reviews/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                {b && <span style={{ width: 9, height: 9, borderRadius: '50%', background: b.color, flexShrink: 0 }} />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                <span style={{ fontSize: 11.5, color: changes ? 'var(--accent)' : 'var(--text-muted)' }}>{changes ? 'Changes requested' : 'Waiting on client'}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)', minWidth: 70, textAlign: 'right' }}>{b?.name}</span>
              </Link>
            )
          })}
        </div>
      )}

      {!isClientOnly && activeProjects.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Projects</div>
            <Link href="/projects" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>See all</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
            {activeProjects.map((p) => (
              <ProjectCard key={p.id} project={p} brand={brandById.get(p.brandSpaceId)!} progress={projectProgress.get(p.id) ?? { total: 0, done: 0 }} />
            ))}
          </div>
        </div>
      )}

      {!isClientOnly && activeCampaigns.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Campaigns</div>
            <Link href="/campaigns" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>See all</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
            {activeCampaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} brand={brandById.get(c.brandSpaceId)!} progress={campaignProgress.get(c.id) ?? { total: 0, published: 0 }} />
            ))}
          </div>
        </div>
      )}

      {brands.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>{isClientOnly ? 'Your brand' : 'Your brands'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
            {brands.map((b) => {
              const open = openByBrand.get(b.id) ?? 0
              return (
                <Link key={b.id} href={`/brand-spaces/${b.id}`} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: b.color }} />
                    <span style={{ fontWeight: 600 }}>{b.name}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {ROLE_LABEL[b.role]}
                    {b.role !== 'client' && ` · ${open} open ${open === 1 ? 'task' : 'tasks'}`}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
