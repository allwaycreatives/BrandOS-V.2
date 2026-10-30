import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { formatBytes } from '@/lib/galleryFormat'
import { updateGallery, setGalleryPasscode } from '../actions'
import GalleryUploader from './GalleryUploader'
import LinkEditor from './LinkEditor'
import { ShareBox, DeleteGalleryButton } from './GalleryControls'
import FilesGrid, { type AdminItem } from './FilesGrid'

export const maxDuration = 120 // reading the dates of many photos can take a little while

const SERIF = "Georgia, 'Times New Roman', serif"
const COVER_ART = [
  { key: 'full', label: 'Full', art: <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#8a7a68,#2c2620)' }}><div style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translateX(-50%)', width: '50%', height: 3, background: '#fff', opacity: 0.9 }} /></div> },
  { key: 'split', label: 'Split', art: <div style={{ position: 'absolute', inset: 0, display: 'flex' }}><div style={{ flex: 1, background: '#f3f1ed', position: 'relative' }}><div style={{ position: 'absolute', left: '18%', top: '45%', width: '64%', height: 3, background: '#222' }} /></div><div style={{ flex: 1, background: 'linear-gradient(180deg,#8a7a68,#2c2620)' }} /></div> },
  { key: 'classic', label: 'Classic', art: <div style={{ position: 'absolute', inset: 0, background: '#f3f1ed' }}><div style={{ position: 'absolute', left: '30%', top: '12%', width: '40%', height: 3, background: '#222' }} /><div style={{ position: 'absolute', left: '14%', right: '14%', top: '32%', bottom: '10%', background: 'linear-gradient(180deg,#8a7a68,#2c2620)' }} /></div> },
]
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export default async function GalleryManagePage({ params }: { params: { id: string; galleryId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access || access.role === 'client') notFound()

  const gallery = await db.gallery.findUnique({ where: { id: params.galleryId }, include: { items: true, sets: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, project: { select: { id: true, name: true } }, driveConnection: { select: { email: true } } } }).catch(() => null)
  if (!gallery || gallery.brandSpaceId !== params.id) notFound()

  const projects = await db.project.findMany({ where: { brandSpaceId: params.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } }).catch(() => [])
  const items = gallery.items
  // Pictures of files kept in Google Drive are fetched through Brand Console, so they show even before the gallery is published.
  const adminUrl = (id: string, v: string) => `/api/gallery-admin/${gallery.id}/file/${id}?v=${v}`
  const adminItems: AdminItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind as AdminItem['kind'],
    size: i.size,
    preview: i.driveThumbId ? adminUrl(i.id, 't') : i.thumbUrl || (i.kind === 'image' && i.size < 6 * 1024 * 1024 ? (i.driveFileId ? adminUrl(i.id, 'o') : i.url) : null),
    view: i.kind === 'file' ? null : i.driveFileId ? adminUrl(i.id, i.kind === 'image' ? 'w' : 'o') : i.kind === 'image' ? i.webUrl || i.url : i.url,
    setId: i.setId,
    capturedAt: i.capturedAt ? i.capturedAt.toISOString() : null,
  }))
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

      <ShareBox galleryId={gallery.id} token={gallery.slug || gallery.shareToken} published={gallery.published} />
      <LinkEditor galleryId={gallery.id} slug={gallery.slug} suggestFrom={gallery.coverTitle || gallery.title} hasPasscode={!!gallery.passcodeHash} />

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Add files</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {gallery.storage === 'drive' ? (
          gallery.driveConnection ? (
            <>Files are kept in your Google Drive ({gallery.driveConnection.email}), in the Brand Console folder it created there.</>
          ) : (
            <span style={{ color: '#c0392b' }}>This gallery’s Google Drive is not connected any more, so its files can’t be shown or added to. <a href={`/api/google/connect?returnTo=${encodeURIComponent(`/brand-spaces/${params.id}/galleries/${gallery.id}`)}`} style={{ textDecoration: 'underline' }}>Connect Google Drive</a></span>
          )
        ) : (
          <>Files are kept in Brand Console storage.</>
        )}
      </div>
      <GalleryUploader galleryId={gallery.id} storage={gallery.storage === 'drive' ? 'drive' : 'blob'} sets={gallery.sets.map((x) => ({ id: x.id, name: x.name }))} mainSetName={gallery.mainSetName} />

      <div style={{ fontWeight: 600, fontSize: 14, margin: '28px 0 10px' }}>Files</div>
      <FilesGrid galleryId={gallery.id} items={adminItems} sets={gallery.sets.map((x) => ({ id: x.id, name: x.name }))} mainSetName={gallery.mainSetName} coverItemId={gallery.coverItemId} sortMode={gallery.sortMode} canReadDates={gallery.storage === 'drive' && !!gallery.driveConnection} />

      <div style={{ fontWeight: 600, fontSize: 14, margin: '32px 0 4px' }}>Cover & welcome message</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>This is the first thing your client sees, before the photos. Leave a line empty to hide it.</div>
      <form action={updateGallery.bind(null, gallery.id)} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12, alignItems: 'end', marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
          Cover title
          <input name="coverTitle" defaultValue={gallery.coverTitle ?? ''} placeholder={gallery.title} style={{ width: '100%', marginTop: 4 }} />
          <span style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)' }}>For example “El Shaddai Falcons Academy 2026 Spelling Bee Competition”. Empty uses the gallery name.</span>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Subtitle
          <input name="coverSubtitle" defaultValue={gallery.coverSubtitle ?? ''} placeholder="Photo highlights" style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Prepared for
          <input name="preparedFor" defaultValue={gallery.preparedFor ?? ''} placeholder="El Shaddai Falcons Academy" style={{ width: '100%', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>
          Thank-you message
          <textarea name="description" rows={4} defaultValue={gallery.description ?? ''} placeholder="Thank you for trusting us with such a special day. It was an honour to capture it." style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
          <span style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)' }}>Shown on the cover, under the title. Two or three sentences look best.</span>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Page look
          <select name="theme" defaultValue={gallery.theme} style={{ width: '100%', marginTop: 4 }}>
            <option value="light">Light, like a printed album</option>
            <option value="dark">Dark, like a cinema</option>
          </select>
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Cover style</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {COVER_ART.map((c) => (
              <label key={c.key} style={{ cursor: 'pointer', textAlign: 'center', fontSize: 12 }}>
                <input type="radio" name="coverStyle" value={c.key} defaultChecked={gallery.coverStyle === c.key} style={{ display: 'none' }} className="cover-radio" />
                <span className="cover-art" style={{ display: 'block', position: 'relative', width: 120, height: 76, borderRadius: 8, overflow: 'hidden', border: '2px solid var(--border)', marginBottom: 4 }}>{c.art}</span>
                {c.label}
              </label>
            ))}
          </div>
          <style dangerouslySetInnerHTML={{ __html: '.cover-radio:checked + .cover-art { border-color: var(--accent) !important; box-shadow: 0 0 0 2px var(--accent-dim); }' }} />
        </div>
        {/* the details below belong to the same save button */}
        <input type="hidden" name="title" value={gallery.title} />
        <input type="hidden" name="projectId" value={gallery.projectId ?? ''} />
        <input type="hidden" name="eventDate" value={day(gallery.eventDate)} />
        <input type="hidden" name="expiresAt" value={day(gallery.expiresAt)} />
        {gallery.allowDownload && <input type="hidden" name="allowDownload" value="on" />}
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="primary" type="submit">Save cover</button>
          <a href={`/gallery/${gallery.slug || gallery.shareToken}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>See how it looks ↗</a>
        </div>
      </form>

      <div style={{ fontWeight: 600, fontSize: 14, margin: '26px 0 8px' }}>Details</div>
      <form action={updateGallery.bind(null, gallery.id)} className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, alignItems: 'end', marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Gallery name (only you see this)
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
        <label style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" name="allowDownload" defaultChecked={gallery.allowDownload} />
          Let the client download
        </label>
        {/* keep the cover settings when only the details are saved */}
        <input type="hidden" name="coverTitle" value={gallery.coverTitle ?? ''} />
        <input type="hidden" name="coverSubtitle" value={gallery.coverSubtitle ?? ''} />
        <input type="hidden" name="preparedFor" value={gallery.preparedFor ?? ''} />
        <input type="hidden" name="description" value={gallery.description ?? ''} />
        <input type="hidden" name="theme" value={gallery.theme} />
        <input type="hidden" name="coverStyle" value={gallery.coverStyle} />
        <button className="primary" type="submit">Save details</button>
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
