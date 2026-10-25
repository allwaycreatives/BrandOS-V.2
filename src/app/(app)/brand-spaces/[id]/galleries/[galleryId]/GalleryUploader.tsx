'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadFile, prepareImage } from '@/lib/uploadFile'
import { formatBytes, kindOf, safeFileName } from '@/lib/galleryFormat'
import { addGalleryItem } from '../actions'

type Status = 'queued' | 'preparing' | 'uploading' | 'saving' | 'done' | 'error'
type Job = { id: string; file: File; status: Status; pct: number; error?: string }

const THUMB_EDGE = 720
const MAX_ACTIVE = 3
const MAX_BYTES_IN_FLIGHT = 1.5 * 1024 * 1024 * 1024

function fit(w: number, h: number, max: number): [number, number] {
  const s = Math.min(1, max / Math.max(w, h))
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]
}

function toJpeg(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  const [cw, ch] = fit(w, h, THUMB_EDGE)
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(source, 0, 0, cw, ch)
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8))
}

type Derived = { thumb: Blob | null; web: File | null; width: number | null; height: number | null }
const NONE: Derived = { thumb: null, web: null, width: null, height: null }

// Small copies made in the browser, so the client's page loads fast. The original is never changed.
async function imageDerived(file: File): Promise<Derived> {
  if (typeof createImageBitmap !== 'function') return NONE
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return NONE // RAW, HEIC and other formats this browser cannot read: still delivered, just without a preview
  }
  try {
    const thumb = await toJpeg(bitmap, bitmap.width, bitmap.height)
    const shrunk = await prepareImage(file)
    return { thumb, web: shrunk !== file ? shrunk : null, width: bitmap.width, height: bitmap.height }
  } catch {
    return { ...NONE, width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

function videoDerived(file: File): Promise<Derived> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'metadata'
    v.playsInline = true
    let finished = false
    const finish = (d: Derived) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      URL.revokeObjectURL(url)
      v.removeAttribute('src')
      v.load()
      resolve(d)
    }
    const timer = setTimeout(() => finish(NONE), 20000)
    v.onerror = () => finish(NONE)
    v.onloadedmetadata = () => {
      try {
        v.currentTime = Math.min(1, (v.duration || 2) / 2)
      } catch {
        finish(NONE)
      }
    }
    v.onseeked = async () => {
      try {
        const w = v.videoWidth
        const h = v.videoHeight
        const thumb = w && h ? await toJpeg(v, w, h) : null
        finish({ thumb, web: null, width: w || null, height: h || null })
      } catch {
        finish(NONE)
      }
    }
    v.src = url
  })
}

export default function GalleryUploader({ galleryId }: { galleryId: string }) {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [dragging, setDragging] = useState(false)
  const queue = useRef<Job[]>([])
  const active = useRef<Map<string, number>>(new Map())
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const input = useRef<HTMLInputElement>(null)

  const update = useCallback((id: string, patch: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j))), [])

  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => router.refresh(), 1200)
  }, [router])

  const run = useCallback(
    async (job: Job) => {
      const { file } = job
      const itemId = crypto.randomUUID()
      try {
        update(job.id, { status: 'preparing', pct: 0, error: undefined })
        const kind = kindOf(file.type, file.name)
        const d = kind === 'image' ? await imageDerived(file) : kind === 'video' ? await videoDerived(file) : NONE

        const base = `galleries/${galleryId}/${itemId}`
        const common = { direct: true, compress: false, handleUploadUrl: '/api/gallery-upload', clientPayload: JSON.stringify({ galleryId }), stallMs: 60_000 }
        update(job.id, { status: 'uploading' })

        let thumbUrl: string | null = null
        let webUrl: string | null = null
        if (d.thumb) thumbUrl = (await uploadFile(new File([d.thumb], 'thumb.jpg', { type: 'image/jpeg' }), { ...common, pathname: `${base}/thumb.jpg` })).url
        if (d.web) {
          const ext = d.web.type === 'image/webp' ? 'webp' : 'jpg'
          webUrl = (await uploadFile(new File([d.web], `web.${ext}`, { type: d.web.type }), { ...common, pathname: `${base}/web.${ext}` })).url
        }
        const original = await uploadFile(file, { ...common, pathname: `${base}/${safeFileName(file.name)}`, onProgress: (p) => p >= 0 && update(job.id, { pct: p }) })

        update(job.id, { status: 'saving', pct: 100 })
        const res = await addGalleryItem(galleryId, {
          name: file.name,
          url: original.url,
          thumbUrl,
          webUrl,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          width: d.width,
          height: d.height,
        })
        if ('error' in res) throw new Error(res.error)
        update(job.id, { status: 'done', pct: 100 })
        scheduleRefresh()
      } catch (e) {
        update(job.id, { status: 'error', error: (e as Error).message || 'Upload failed.' })
      }
    },
    [galleryId, update, scheduleRefresh],
  )

  const pump = useCallback(() => {
    for (;;) {
      const next = queue.current[0]
      if (!next) return
      const inFlight = Array.from(active.current.values()).reduce((a, b) => a + b, 0)
      const canStart = active.current.size === 0 || (active.current.size < MAX_ACTIVE && inFlight + next.file.size <= MAX_BYTES_IN_FLIGHT)
      if (!canStart) return
      queue.current.shift()
      active.current.set(next.id, next.file.size)
      run(next).finally(() => {
        active.current.delete(next.id)
        pump()
      })
    }
  }, [run])

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list).filter((f) => f.size > 0)
      if (!files.length) return
      const fresh: Job[] = files.map((file) => ({ id: crypto.randomUUID(), file, status: 'queued', pct: 0 }))
      setJobs((prev) => [...prev, ...fresh])
      queue.current.push(...fresh)
      pump()
    },
    [pump],
  )

  const retry = (job: Job) => {
    update(job.id, { status: 'queued', pct: 0, error: undefined })
    queue.current.push({ ...job, status: 'queued' })
    pump()
  }

  const busy = jobs.some((j) => j.status !== 'done' && j.status !== 'error')
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  const total = jobs.reduce((n, j) => n + j.file.size, 0)
  const sent = jobs.reduce((n, j) => n + (j.status === 'done' ? j.file.size : (j.file.size * (j.status === 'uploading' ? j.pct : j.status === 'saving' ? 100 : 0)) / 100), 0)
  const doneCount = jobs.filter((j) => j.status === 'done').length
  const failed = jobs.filter((j) => j.status === 'error').length
  const overall = total ? Math.round((sent / total) * 100) : 0
  const label: Record<Status, string> = { queued: 'Waiting', preparing: 'Preparing preview', uploading: 'Uploading', saving: 'Saving', done: 'Done', error: 'Failed' }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => input.current?.click()}
        style={{ border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`, background: dragging ? 'var(--accent-dim)' : 'var(--bg-card)', borderRadius: 14, padding: '28px 16px', textAlign: 'center', cursor: 'pointer' }}
      >
        <div style={{ fontWeight: 600, fontSize: 15 }}>Drop photos and videos here, or click to choose</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>Full quality, nothing is shrunk. Big files are fine; keep this page open until they finish.</div>
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {jobs.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{busy ? `Uploading ${doneCount} of ${jobs.length}` : failed ? `${doneCount} uploaded, ${failed} failed` : `All ${doneCount} uploaded`}</span>
            <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(sent)} of {formatBytes(total)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${overall}%`, height: '100%', background: failed && !busy ? '#c0392b' : 'var(--accent)', transition: 'width .3s' }} />
          </div>
          <div style={{ marginTop: 10, maxHeight: 260, overflowY: 'auto' }}>
            {jobs.filter((j) => j.status !== 'done').slice(0, 60).map((j) => (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.file.name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{formatBytes(j.file.size)}</span>
                <span style={{ width: 120, textAlign: 'right', color: j.status === 'error' ? '#c0392b' : 'var(--text-secondary)' }}>
                  {j.status === 'uploading' ? `${j.pct}%` : label[j.status]}
                </span>
                {j.status === 'error' && <button type="button" onClick={() => retry(j)} style={{ padding: '2px 10px', fontSize: 12 }}>Retry</button>}
              </div>
            ))}
            {jobs.some((j) => j.status === 'error') && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>{jobs.find((j) => j.status === 'error')?.error}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
