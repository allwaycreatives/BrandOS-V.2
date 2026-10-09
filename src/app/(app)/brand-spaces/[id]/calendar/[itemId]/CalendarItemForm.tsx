'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { updateCalendarItemDetails, deleteCalendarItem, type ItemDetails } from '../actions'
import { PLATFORMS } from '../../campaigns/constants'
import { CONTENT_TYPES, PRIORITIES, typeOf } from '@/lib/contentOptions'
import { setDirty } from '@/lib/dirtyFlag'
import type { Strategy } from '@/lib/strategy'

const STATUS_OPTIONS = [
  { key: 'idea', label: 'Idea (hidden from the client)' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

type TextKey = 'hook' | 'cta' | 'objective' | 'keyMessage' | 'caption' | 'successMetric' | 'notes' | 'script' | 'productionNotes' | 'assetUrl'

// A post, laid out like a Notion page: the title, a list of properties, then the content brief.
export default function CalendarItemForm({ brandSpaceId, itemId, initial, strategy, clientLine }: { brandSpaceId: string; itemId: string; initial: ItemDetails; strategy: Strategy; clientLine: string }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(initial))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof ItemDetails>(key: K, val: ItemDetails[K]) => setV((x) => ({ ...x, [key]: val }))

  const dirty = JSON.stringify(v) !== savedSnapshot
  useEffect(() => {
    setDirty(dirty)
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => () => setDirty(false), [])

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
      setSavedSnapshot(JSON.stringify(v))
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1500)
      router.refresh()
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
        setDirty(false)
        router.push(`/brand-spaces/${brandSpaceId}/calendar`)
        router.refresh()
      } else setError('Could not delete this post.')
    })
  }

  const row = (name: string, control: React.ReactNode) => (
    <div className="prop-row">
      <div className="prop-label">{name}</div>
      <div>{control}</div>
    </div>
  )
  const input = (key: TextKey, placeholder = '') => <input style={{ width: '100%' }} value={v[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
  const area = (key: TextKey, rows = 2, placeholder = '') => <textarea rows={rows} style={{ width: '100%' }} value={v[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
  const select = (value: string, onChange: (x: string) => void, options: { value: string; label: string }[]) => (
    <select style={{ width: '100%', maxWidth: 360 }} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
  const heading = (t: string, hint?: string) => (
    <div style={{ margin: '26px 0 8px' }}>
      <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 19, fontWeight: 600 }}>{t}</div>
      {hint && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{hint}</div>}
    </div>
  )

  return (
    <div>
      <input className="post-title" value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="Untitled" aria-label="Title" />
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{clientLine}</div>

      <div>
        {row('Platform', select(v.platform, (x) => set('platform', x), Array.from(new Set([...PLATFORMS, v.platform])).map((p) => ({ value: p, label: p }))))}
        {row('Format', select(v.contentType, (x) => set('contentType', x), [{ value: '', label: 'Choose a format' }, ...CONTENT_TYPES.map((t) => ({ value: t.key, label: t.label }))]))}
        {row('Content pillar', select(v.pillar, (x) => set('pillar', x), [{ value: '', label: strategy.pillars.length ? 'No pillar' : 'No pillar (add them on the Strategy page)' }, ...pillarNames.map((n) => ({ value: n, label: n }))]))}
        {row('Series', select(v.series, (x) => set('series', x), [{ value: '', label: 'No series' }, ...seriesNames.map((n) => ({ value: n, label: n }))]))}
        {row('Priority', select(v.priority, (x) => set('priority', x), PRIORITIES.map((p) => ({ value: p.key, label: p.label }))))}
        {row('Status', select(v.status, (x) => set('status', x), STATUS_OPTIONS.map((s) => ({ value: s.key, label: s.label }))))}
        {row('Publish date', <input type="date" value={v.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />)}
        {row('Production date', <input type="date" value={v.productionDate} onChange={(e) => set('productionDate', e.target.value)} />)}
        {row(
          'Hook',
          <div>
            {input('hook', 'The chosen hook: the first line that stops the scroll')}
            {v.hookOptions.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 4px' }}>Hook options</div>}
            {v.hookOptions.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                <input style={{ flex: 1, minWidth: 0 }} value={h} onChange={(e) => set('hookOptions', v.hookOptions.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={`Hook option ${i + 1}`} />
                <button type="button" onClick={() => set('hook', h)} disabled={!h.trim()} style={{ fontSize: 12 }}>{v.hook && v.hook === h ? '✓ Chosen' : 'Use this'}</button>
                <button type="button" onClick={() => set('hookOptions', v.hookOptions.filter((_, idx) => idx !== i))} aria-label="Remove hook option" style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Remove</button>
              </div>
            ))}
            {v.hookOptions.length < 12 && (
              <button type="button" onClick={() => set('hookOptions', [...v.hookOptions, ''])} style={{ fontSize: 12.5, marginTop: 4 }}>Add a hook option</button>
            )}
          </div>
        )}
        {row('CTA', input('cta', 'What should the viewer do next?'))}
        {row('Objective', area('objective', 2, 'What this piece is for, and who it is for'))}
        {row('Main message', input('keyMessage', 'The one thing this piece needs to communicate'))}
        {row('Caption', area('caption', 3, 'The client sees this'))}
        {row('Success metric', input('successMetric', 'How will we know it worked?'))}
        {row('Notes', area('notes', 2, 'Team only'))}
      </div>

      {heading('Content brief', type?.scriptLabel ?? 'Script or outline')}
      <textarea rows={isText ? 8 : 12} style={{ width: '100%' }} value={v.script} onChange={(e) => set('script', e.target.value)} placeholder="Write the script, outline or draft here." />

      {heading(isText ? 'Files' : 'Production')}
      {!isText && <div>{row(isVideo ? 'Production notes' : 'Design notes', area('productionNotes', 4, isVideo ? 'Filming, B-roll, props, location, editing' : 'Visuals, layout, references'))}</div>}
      {row(isVideo ? 'Video link' : 'File link', input('assetUrl', 'Google Drive set to "Anyone with the link", YouTube, or Vimeo'))}
      {!isText &&
        row(
          'Thumbnail',
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ flex: '1 1 220px' }} value={v.thumbnailUrl} onChange={(e) => set('thumbnailUrl', e.target.value)} placeholder="Paste a link or upload an image" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload image'}</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={onThumb} style={{ display: 'none' }} />
            </div>
            {v.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnailUrl} alt="Thumbnail preview" style={{ marginTop: 8, height: 96, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
            )}
          </div>
        )}

      <div className="post-savebar">
        <button className="primary" onClick={handleSave} disabled={isPending || uploading || !dirty}>{isPending ? 'Saving...' : 'Save'}</button>
        <span style={{ fontSize: 12.5, color: dirty ? 'var(--accent-text)' : 'var(--text-muted)' }}>{justSaved ? 'Saved' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        {error && <span style={{ fontSize: 12.5, color: 'var(--accent-text)' }}>{error}</span>}
        <button type="button" onClick={remove} disabled={isPending} style={{ marginLeft: 'auto', fontSize: 12.5 }}>Delete post</button>
      </div>
    </div>
  )
}
