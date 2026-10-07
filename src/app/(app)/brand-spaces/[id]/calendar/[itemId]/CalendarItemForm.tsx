'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { updateCalendarItemDetails, deleteCalendarItem, type ItemDetails } from '../actions'
import { PLATFORMS } from '../../campaigns/constants'

const STATUS_OPTIONS = [
  { key: 'idea', label: 'Idea (hidden from the client)' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
]

export default function CalendarItemForm({ brandSpaceId, itemId, initial }: { brandSpaceId: string; itemId: string; initial: ItemDetails }) {
  const router = useRouter()
  const [values, setValues] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (key: keyof ItemDetails, v: string) => setValues((x) => ({ ...x, [key]: v }))

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const res = await updateCalendarItemDetails(brandSpaceId, itemId, values)
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

  const label = (text: string) => <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{text}</div>
  const text = (key: keyof ItemDetails, title: string, area = false, rows = 3, placeholder = '') => (
    <div style={{ marginBottom: 16 }}>
      {label(title)}
      {area ? (
        <textarea rows={rows} style={{ width: '100%' }} value={values[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
      ) : (
        <input style={{ width: '100%' }} value={values[key]} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
      )}
    </div>
  )

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 140px' }}>
          {label('Platform')}
          <select style={{ width: '100%' }} value={values.platform} onChange={(e) => set('platform', e.target.value)}>
            {Array.from(new Set([...PLATFORMS, values.platform])).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          {label('Date')}
          <input type="date" style={{ width: '100%' }} value={values.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          {label('Status')}
          <select style={{ width: '100%' }} value={values.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {text('assetUrl', 'Video or file link (Google Drive set to "Anyone with the link", YouTube, Vimeo)', false, 1, 'https://drive.google.com/file/d/...')}

      <div style={{ marginBottom: 16 }}>
        {label('Thumbnail (shown next to the video). Paste a link or upload an image')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ flex: '1 1 220px' }} value={values.thumbnailUrl} onChange={(e) => set('thumbnailUrl', e.target.value)} placeholder="https://..." />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload image'}</button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onThumb} style={{ display: 'none' }} />
        </div>
        {values.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values.thumbnailUrl} alt="Thumbnail preview" style={{ marginTop: 8, height: 96, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
        )}
      </div>

      {text('caption', 'Caption (the client sees this)', true, 4)}
      {text('hook', 'Hook: the first line that stops the scroll')}
      {text('keyMessage', 'Key message: the one thing this piece needs to communicate')}
      {text('script', 'Script (team only)', true, 6)}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="primary" onClick={handleSave} disabled={isPending || uploading}>
          {isPending ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
        <button type="button" onClick={remove} disabled={isPending} style={{ marginLeft: 'auto', fontSize: 12.5 }}>Delete post</button>
      </div>
      {error && <div style={{ fontSize: 12.5, color: 'var(--accent-text)', marginTop: 10 }}>{error}</div>}
    </div>
  )
}
