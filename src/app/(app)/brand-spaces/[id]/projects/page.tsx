import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { brandColor } from '@/lib/brandColor'
import { getProjectProgress } from '@/lib/projects'
import { createProject } from './actions'
import ProjectCard from '@/components/ProjectCard'

export default async function BrandProjectsPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()
  const { brandSpace } = access

  const projects = await db.project.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' } }).catch(() => [])
  const progress = await getProjectProgress(projects.map((p) => p.id))
  const brand = { name: brandSpace.name, color: brandColor(brandSpace.name) }

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Projects</div>
        <div className="topbar-sub">A piece of work from brief to delivered: a film, an edit, a design job. Tasks and boards live together.</div>
      </div>

      <form action={createProject} className="card" style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <input type="hidden" name="brandSpaceId" value={params.id} />
        <input name="name" required placeholder="New project, e.g. Brand film" style={{ flex: 1, minWidth: 200 }} />
        <input name="description" placeholder="Short brief (optional)" style={{ flex: 1, minWidth: 200 }} />
        <button className="primary" type="submit">Create project</button>
      </form>

      {projects.length === 0 ? (
        <div className="card-empty">No projects yet. Create one above.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} brand={brand} progress={progress.get(p.id) ?? { total: 0, done: 0 }} />
          ))}
        </div>
      )}
    </div>
  )
}
