import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import { getProjectProgress } from '@/lib/projects'
import { createProject } from '../brand-spaces/[id]/projects/actions'
import { PROJECT_STAGES } from '../brand-spaces/[id]/projects/constants'
import ProjectCard from '@/components/ProjectCard'

export default async function AllProjectsPage() {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')
  const brandById = new Map(brands.map((b) => [b.id, b]))

  const projects = brands.length
    ? await db.project.findMany({ where: { brandSpaceId: { in: brands.map((b) => b.id) } }, orderBy: { createdAt: 'desc' } }).catch(() => [])
    : []
  const progress = await getProjectProgress(projects.map((p) => p.id))

  return (
    <div>
      <div className="topbar-greeting">Projects</div>
      <div className="topbar-sub" style={{ marginBottom: 20 }}>Every piece of work across your brands and clients, from brief to delivered.</div>

      {brands.length > 0 ? (
        <form action={createProject} className="card" style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          <input name="name" required placeholder="New project, e.g. Brand film" style={{ flex: 1, minWidth: 200 }} />
          <select name="brandSpaceId" defaultValue={brands[0].id}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <button className="primary" type="submit">Create project</button>
        </form>
      ) : (
        <div className="card-empty" style={{ marginBottom: 24 }}>Create a brand first, then add projects to it.</div>
      )}

      {PROJECT_STAGES.map((stage) => {
        const list = projects.filter((p) => p.status === stage.key)
        if (list.length === 0) return null
        return (
          <div key={stage.key} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{stage.label} · {list.length}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
              {list.map((p) => (
                <ProjectCard key={p.id} project={p} brand={brandById.get(p.brandSpaceId)!} progress={progress.get(p.id) ?? { total: 0, done: 0 }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
