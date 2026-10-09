'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { updateCalendarItemDetails, deleteCalendarItem, type ItemDetails } from '../actions'
import { PLATFORMS } from '../../campaigns/constants'
import { CONTENT_TYPES, PRIORITIES, typeOf } from '@/lib/contentOptions'
import type { Strategy } from '@/lib/strategy'

const STATUS_OPTIONS = [
  { key: 'idea', label: 'Idea (hidden from the client)' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

export default function CalendarItemForm({ brandSpaceId, itemId, initial, strategy }: { brandSpaceId: string; itemId: string; initial: ItemDetails; strategy: Strategy }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof ItemDetails>(key: K, val: ItemDetails[K]) => setV((x) => ({ ...x, [key]: val }))

  const type = typeOf(v.contentType)
  const isText = v.contentType === 'text' || v.contentType === 'article'
  const isVideo = !!type?.video
  const pillarNames = Array.from(new Set([...strategy.pillars.map((p) => p.name), v.pillar].filter(Boolean)))
  const seriesNames = Array.from(new Set([...strategy.series.filter((s) => !v.pillar || !s.pillar || s.pillar === v.pillar).map((s) => s.name), v.series].filter(Boolean)))

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateCalendarItemDetails(brandSpaceId, itemId, v)
      if (!res.ok) return setError(res.error || 'Could not save.')
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 1500)
    })
  }

  async function onThumb(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Please choose an image for the thumbnail.')
    if (f.size > 5 * 1024 * 1024) return setError('Thumbnails up to 5 MB. Resize it, or paste a link instead.')
    setUploading(true)
    setError(null)
    try {
      const blob = await upload(f.name, f, { access: 'public', handleUploadUrl: '/api/upload' })
      set('thumbnailUrl', blob.url)
    } catch {
      setError('Upload failed. Try again, or paste a link instead.')
    } finally {
      setUploading(false)
    }
  }

  function remove() {
    if (!confirm('Delete this post and any client comments on it? This cannot be undone.')) return
    startTransition(async () => {
      const res = await deleteCalendarItem(brandSpaceId, itemId)
      if (res.ok) {
        router.push(`/brand-spaces/${brandSpaceId}/calendar`)
        router.refresh()
      } else setError('Could not delete this post.')
    })
  }

  const label = (text: string, hint?: string) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{text}</div>
      {hint && <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )
  const section = (title: string, children: React.ReactNode) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
  type TextKey = 'objective' | 'keyMessage' | 'script' | 'cta' | 'productionNotes' | 'caption' | 'successMetric' | 'notes' | 'assetUrl' | 'hook'
  const text = (key: TextKey, title: string, o: { area?: boolean; rows?: number; placeholder?: string; hint?: string } = {}) => (
    <div style={{ marginBottom: 16 }}>
      {label(title, o.hint)}
      {o.area ? (
        <textarea rows={o.rows ?? 3} style={{ width: '100%' }} value={v[key]} placeholder={o.placeholder} onChange={(e) => set(key, e.target.value)} />
      ) : (
        <input style={{ width: '100%' }} value={v[key]} placeholder={o.placeholder} onChange={(e) => set(key, e.target.value)} />
      )}
    </div>
  )
  const cell = (flex: string, children: React.ReactNode) => <div style={{ flex }}>{children}</div>

  return (
    <div>
      {section(
        'Plan',
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {cell('1 1 200px', <>{label('Format')}<select style={{ width: '100%' }} value={v.contentType} onChange={(e) => set('contentType', e.target.value)}>
              <option value="">Choose a format</option>
              {CONTENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select></>)}
            {cell('1 1 140px', <>{label('Platform')}<select style={{ width: '100%' }} value={v.platform} onChange={(e) => set('platform', e.target.value)}>
              {Array.from(new Set([...PLATFORMS, v.platform])).map((p) => <option key={p}>{p}</option>)}
            </select></>)}
            {cell('1 1 200px', <>{label('Status')}<select style={{ width: '100%' }} value={v.status} onChange={(e) => set('status', e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></>)}
            {cell('1 1 110px', <>{label('Priority')}<select style={{ width: '100%' }} value={v.priority} onChange={(e) => set('priority', e.target.value)}>
              {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select></>)}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {cell('1 1 160px', <>{label('Publish date')}<input type="date" style={{ width: '100%' }} value={v.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} /></>)}
            {cell('1 1 160px', <>{label('Production date', 'When it is made')}<input type="date" style={{ width: '100%' }} value={v.productionDate} onChange={(e) => set('productionDate', e.target.value)} /></>)}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {cell('1 1 200px', <>{label('Pillar', strategy.pillars.length === 0 ? 'Add pillars on the Strategy page' : undefined)}<select style={{ width: '100%' }} value={v.pillar} onChange={(e) => set('pillar', e.target.value)}>
              <option value="">No pillar</option>
              {pillarNames.map((n) => <option key={n}>{n}</option>)}
            </select></>)}
            {cell('1 1 200px', <>{label('Series')}<select style={{ width: '100%' }} value={v.series} onChange={(e) => set('series', e.target.value)}>
              <option value="">No series</option>
              {seriesNames.map((n) => <option key={n}>{n}</option>)}
            </select></>)}
          </div>
        </>
      )}

      {section(
        'The brief',
        <>
          {text('objective', 'Objective and who it is for', { area: true, rows: 2, hint: 'What this piece is meant to do, and for whom.' })}
          {text('keyMessage', 'Main message', { hint: 'The one thing this piece needs to communicate.' })}

          <div style={{ marginBottom: 16 }}>
            {label('Hook options', 'Write several, then pick the one you will use.')}
            {v.hookOptions.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input style={{ flex: 1, minWidth: 0 }} value={h} onChange={(e) => set('hookOptions', v.hookOptions.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={`Hook option ${i + 1}`} />
                <button type="button" onClick={() => set('hook', h)} disabled={!h.trim()} style={{ fontSize: 12 }}>{v.hook && v.hook === h ? '✓ Chosen' : 'Use this'}</button>
                <button type="button" onClick={() => set('hookOptions', v.hookOptions.filter((_, idx) => idx !== i))} aria-label="Remove hook" style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Remove</button>
              </div>
            ))}
            {v.hookOptions.length < 12 && <button type="button" onClick={() => set('hookOptions', [...v.hookOptions, ''])} style={{ fontSize: 12.5 }}>Add a hook option</button>}
          </div>
          {text('hook', 'Chosen hook', { hint: 'The first line that stops the scroll. This is the one the plan shows.' })}
          {text('script', type?.scriptLabel ?? 'Script or outline', { area: true, rows: isText ? 5 : 7 })}
          {text('cta', 'Call to action', { placeholder: 'What should the viewer do next?' })}
        </>
      )}

      {section(
        isText ? 'Files' : 'Production',
        <>
          {!isText && text('productionNotes', isVideo ? 'Production notes' : 'Design notes', { area: true, rows: 4, hint: isVideo ? 'Filming, B-roll, props, location, editing notes.' : 'Visuals, layout, references.' })}
          {text('assetUrl', isVideo ? 'Video link (Google Drive set to "Anyone with the link", YouTube, Vimeo)' : 'File or image link', { placeholder: 'https://drive.google.com/file/d/...' })}
          {!isText && (
            <div style={{ marginBottom: 4 }}>
              {label('Thumbnail (shown next to the video)', 'Paste a link or upload an image.')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{ flex: '1 1 220px' }} value={v.thumbnailUrl} onChange={(e) => set('thumbnailUrl', e.target.value)} placeholder="https://..." />
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload image'}</button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onThumb} style={{ display: 'none' }} />
              </div>
              {v.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnailUrl} alt="Thumbnail preview" style={{ marginTop: 8, height: 96, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
              )}
            </div>
          )}
        </>
      )}

      {section(
        'Publishing',
        <>
          {text('caption', 'Caption (the client sees this)', { area: true, rows: 4 })}
          {text('successMetric', 'Success metric', { placeholder: 'How will we know it worked?' })}
        </>
      )}

      {section('Team notes', <>{text('notes', 'Notes (team only)', { area: true, rows: 3 })}</>)}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" onClick={handleSave} disabled={isPending || uploading}>{isPending ? 'Saving...' : saved ? 'Saved!' : 'Save'}</button>
        <button type="button" onClick={remove} disabled={isPending} style={{ marginLeft: 'auto', fontSize: 12.5 }}>Delete post</button>
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--accent-text)', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
