import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { formatBytes, naturalSort } from '@/lib/galleryFormat'
import { updateGallery, setGalleryPasscode } from '../actions'
import GalleryUploader from './GalleryUploader'
import { ShareBox, ItemTile, DeleteGalleryButton } from './GalleryControls'

const SERIF = "Georgia, 'Times New Roman', serif"
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export default async function GalleryManagePage({ params }: { params: { id: string; galleryId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()

  const gallery = await db.gallery.findUnique({ where: { id: params.galleryId }, include: { items: true, project: { select: { id: true, name: true } } } }).catch(() => null)
  if (!gallery || gallery.brandSpaceId !== params.id) notFound()

  const projects = await db.project.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }).catch(() => [])
  const items = naturalSort(gallery.items)
  const bytes = items.reduce((n, i) => n + i.size, 0)
  const photos = items.filter((i) => i.kind === 'image').length
  const videos = items.filter((i) => i.kind === 'video').length

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/galleries`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← Galleries
      </Link>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{gallery.title}</h1>
        {gallery.project && (
          <Link href={`/brand-spaces/${params.id}/projects/${gallery.project.id}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 12.5, color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 10px' }}>
            ▣ Project: {gallery.project.name}
          </Link>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {items.length} item{items.length === 1 ? '' : 's'} ({photos} photo{photos === 1 ? '' : 's'}, {videos} video{videos === 1 ? '' : 's'}) · {formatBytes(bytes)} · {gallery.published ? 'Published' : 'Draft'}
        </div>
      </div>

      <ShareBox galleryId={gallery.id} token={gallery.shareToken} published={gallery.published} />

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Add files</div>
      <GalleryUploader galleryId={gallery.id} />

      <div style={{ fontWeight: 600, fontSize: 14, margin: '28px 0 10px' }}>Files</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing here yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
          {items.map((i) => (
            <ItemTile key={i.id} galleryId={gallery.id} item={{ id: i.id, name: i.name, kind: i.kind, size: i.size, thumbUrl: i.thumbUrl, url: i.url }} isCover={gallery.coverItemId === i.id} />
          ))}
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: 14, margin: '32px 0 8px' }}>Settings</div>
      <form action={updateGallery.bind(null, gallery.id)} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, alignItems: 'end', marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Name
          <input name="title" required defaultValue={gallery.title} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Date of the shoot
          <input type="date" name="eventDate" defaultValue={day(gallery.eventDate)} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Link stops working on
          <input type="date" name="expiresAt" defaultValue={day(gallery.expiresAt)} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Project
          <select name="projectId" defaultValue={gallery.projectId ?? ''} style={{ width: '100%', marginTop: 4 }}>
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Client page look
          <select name="theme" defaultValue={gallery.theme} style={{ width: '100%', marginTop: 4 }}>
            <option value="light">Light, like a printed album</option>
            <option value="dark">Dark, like a cinema</option>
          </select>
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Cover style</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { key: 'full', label: 'Full', art: <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#8a7a68,#2c2620)' }}><div style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)', width: '50%', height: 3, background: '#fff', opacity: 0.9 }} /></div> },
              { key: 'split', label: 'Split', art: <div style={{ position: 'absolute', inset: 0, display: 'flex' }}><div style={{ flex: 1, background: '#f3f1ed', position: 'relative' }}><div style={{ position: 'absolute', left: '18%', top: '45%', width: '64%', height: 3, background: '#222' }} /></div><div style={{ flex: 1, background: 'linear-gradient(180deg,#8a7a68,#2c2620)' }} /></div> },
              { key: 'classic', label: 'Classic', art: <div style={{ position: 'absolute', inset: 0, background: '#f3f1ed' }}><div style={{ position: 'absolute', left: '30%', top: '12%', width: '40%', height: 3, background: '#222' }} /><div style={{ position: 'absolute', left: '14%', right: '14%', top: '32%', bottom: '10%', background: 'linear-gradient(180deg,#8a7a68,#2c2620)' }} /></div> },
            ].map((c) => (
              <label key={c.key} style={{ cursor: 'pointer', textAlign: 'center', fontSize: 12 }}>
                <input type="radio" name="coverStyle" value={c.key} defaultChecked={gallery.coverStyle === c.key} style={{ display: 'none' }} className="cover-radio" />
                <span className="cover-art" style={{ display: 'block', position: 'relative', width: 120, height: 76, borderRadius: 8, overflow: 'hidden', border: '2px solid var(--border)', marginBottom: 4 }}>{c.art}</span>
                {c.label}
              </label>
            ))}
          </div>
          <style dangerouslySetInnerHTML={{ __html: '.cover-radio:checked + .cover-art { border-color: var(--accent) !important; box-shadow: 0 0 0 2px var(--accent-dim); }' }} />
        </div>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
          Message to your client
          <input name="description" defaultValue={gallery.description ?? ''} placeholder="Thank you! Here are your photos." style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="allowDownload" defaultChecked={gallery.allowDownload} />
          Let the client download
        </label>
        <button className="primary" type="submit">Save</button>
      </form>

      <form action={setGalleryPasscode.bind(null, gallery.id)} className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1, minWidth: 200 }}>
          Passcode {gallery.passcodeHash ? '(on)' : '(off)'}
          <input name="passcode" placeholder={gallery.passcodeHash ? 'Type a new one, or leave empty to turn it off' : 'Optional: the client must enter this to open the gallery'} style={{ width: '100%', marginTop: 4 }} />
        </label>
        <button type="submit">Save passcode</button>
      </form>

      <DeleteGalleryButton galleryId={gallery.id} />
    </div>
  )
}
