'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadFile } from '@/lib/uploadFile'
import { formatBytes, safeFileName } from '@/lib/galleryFormat'
import { createDriveSession, driveUpload } from '@/lib/driveUpload'
import { removeWatchVersion, setWatchVersion } from '../actions'

export type WatchVideo = { id: string; name: string; size: number; hasWatch: boolean }

type Busy = { id: string; pct: number } | null

// For each video: add a lighter copy that clients stream (smooth on slow Wi-Fi). The original stays the download.
export default function WatchVersion({ galleryId, storage, videos }: { galleryId: string; storage: 'blob' | 'drive'; videos: WatchVideo[] }) {
  const router = useRouter()
  const pick = useRef<HTMLInputElement>(null)
  const target = useRef<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<{ id: string; message: string } | null>(null)
  const session = useMemo(() => (storage === 'drive' ? createDriveSession(galleryId) : null), [storage, galleryId])

  async function upload(itemId: string, file: File) {
    setError(null)
    setBusy({ id: itemId, pct: 0 })
    try {
      if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) throw new Error('Please choose a video file (an MP4 works best).')
      const onProgress = (pct: number) => pct >= 0 && setBusy({ id: itemId, pct })
      let res
      if (storage === 'drive' && session) {
        // Straight into the owner's Google Drive, in resumable chunks, like the main upload.
        const previews = await session.previewsId()
        const fileId = await driveUpload(file, { name: `${itemId}-watch-${safeFileName(file.name)}`, mimeType: file.type || 'video/mp4', parentId: previews, session, onProgress })
        res = await setWatchVersion(itemId, { drive: { fileId } })
      } else {
        const out = await uploadFile(file, {
          direct: true,
          compress: false,
          handleUploadUrl: '/api/gallery-upload',
          clientPayload: JSON.stringify({ galleryId }),
          stallMs: 60_000,
          pathname: `galleries/${galleryId}/${itemId}/watch-${Date.now()}-${safeFileName(file.name)}`,
          onProgress,
        })
        res = await setWatchVersion(itemId, { url: out.url })
      }
      if ('error' in res) throw new Error(res.error)
      router.refresh()
    } catch (e) {
      setError({ id: itemId, message: (e as Error).message || 'The upload failed. Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>Smooth version (a backup for slow connections)</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: '4px 0 12px', lineHeight: 1.55 }}>
        Clients watch your full-quality original first. If it keeps buffering on a slow connection, the page switches them, at the same spot, to this lighter copy (they can also switch by hand). Add a <b>1080p MP4</b>, about <b>150 to 250 MB</b>. The Download button always gives the original.
        In DaVinci Resolve: Deliver → MP4, H.264, 1920×1080, Quality “Restrict to” (a 7-minute film: about 3500 Kb/s), audio AAC 192.
      </div>

      <input
        ref={pick}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f && target.current) upload(target.current, f)
        }}
      />

      {videos.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload your video first, then add its smooth version here.</div>
      ) : (
        videos.map((v) => {
          const working = busy?.id === v.id
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· original {formatBytes(v.size)}</span></div>
                <div style={{ fontSize: 12, color: working ? 'var(--text-secondary)' : v.hasWatch ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                  {working ? `Uploading the smooth version… ${busy!.pct}%` : v.hasWatch ? '✓ Added. Used automatically if the original buffers.' : 'None yet: everyone streams the original.'}
                </div>
                {error?.id === v.id && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 2 }}>{error.message}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    target.current = v.id
                    pick.current?.click()
                  }}
                >
                  {v.hasWatch ? 'Replace' : 'Add smooth version'}
                </button>
                {v.hasWatch && !working && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={async () => {
                      if (!confirm('Remove the smooth version? Everyone will stream the original.')) return
                      await removeWatchVersion(v.id)
                      router.refresh()
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
