import Link from 'next/link'
import { PROJECT_STAGES } from '@/app/(app)/brand-spaces/[id]/projects/constants'

export default function ProjectCard({
  project,
  brand,
  progress,
}: {
  project: { id: string; brandSpaceId: string; name: string; description: string | null; status: string; dueDate: Date | null }
  brand: { name: string; color: string }
  progress: { total: number; done: number }
}) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const stage = PROJECT_STAGES.find((s) => s.key === project.status)?.label ?? project.status
  return (
    <Link href={`/brand-spaces/${project.brandSpaceId}/projects/${project.id}`} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: brand.color }} />
        <span style={{ flex: 1 }}>{brand.name}</span>
        <span>{stage}</span>
      </div>
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 600, fontSize: 16 }}>{project.name}</div>
      {project.description && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{project.description}</div>}
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        {progress.total === 0 ? 'No tasks yet' : `${progress.done} of ${progress.total} tasks done`}
        {project.dueDate ? ` · due ${project.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
      </div>
    </Link>
  )
}
