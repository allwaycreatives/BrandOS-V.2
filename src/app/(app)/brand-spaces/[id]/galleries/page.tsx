import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { formatBytes } from '@/lib/galleryFormat'
import { createGallery } from './actions'

const SERIF = "Georgia, 'Times New Roman', serif"
const when = (d: Date | null) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default async function GalleriesPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()
  const { brandSpace } = access

  const galleries = await db.gallery
    .findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, include: { items: { select: { id: true, size: true, thumbUrl: true } }, project: { select: { name: true } } } })
    .catch(() => [])
  const projects = await db.project.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }).catch(() => [])

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Galleries</div>
        <div className="topbar-sub">Deliver photos and videos to {brandSpace.name} in full quality, even gigabytes of them, with one private link.</div>
      </div>

      <form action={createGallery} className="card" style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        <input type="hidden" name="brandSpaceId" value={params.id} />
        <input name="title" required placeholder="New gallery name, like “Launch shoot”" style={{ flex: 1, minWidth: 220 }} />
        <select name="projectId" defaultValue="" title="Optional: the project this delivery belongs to">
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input type="date" name="eventDate" title="Date of the shoot or event" />
        <button className="primary" type="submit">Create gallery</button>
      </form>

      {galleries.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>No galleries yet. Create one, upload your files, then publish it and send the link.</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
        {galleries.map((g) => {
          const cover = g.items.find((i) => i.id === g.coverItemId)?.thumbUrl || g.items.find((i) => i.thumbUrl)?.thumbUrl
          const bytes = g.items.reduce((n, i) => n + i.size, 0)
          return (
            <Link key={g.id} href={`/brand-spaces/${params.id}/galleries/${g.id}`} style={{ display: 'block' }}>
              <div style={{ aspectRatio: '4 / 3', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {cover ? <img src={cover} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No photos yet</span>}
              </div>
              <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, marginTop: 8 }}>{g.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: g.published ? 'var(--accent-text)' : 'var(--text-muted)' }}>{g.published ? '● Published' : '○ Draft'}</span>
                <span>
                  {g.items.length} item{g.items.length === 1 ? '' : 's'} · {formatBytes(bytes)}
                </span>
                {g.eventDate && <span>· {when(g.eventDate)}</span>}
                {g.project && <span style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0 8px', fontSize: 11.5 }}>▣ {g.project.name}</span>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
