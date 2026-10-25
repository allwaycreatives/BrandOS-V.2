'use client'

import { useState, useTransition } from 'react'
import { deleteGallery, deleteGalleryItem, setGalleryCover, setGalleryPublished } from '../actions'
import { formatBytes } from '@/lib/galleryFormat'

export function ShareBox({ galleryId, token, published }: { galleryId: string; token: string; published: boolean }) {
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  const link = typeof window !== 'undefined' ? `${window.location.origin}/gallery/${token}` : `/gallery/${token}`
  return (
    <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
      <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 220, fontSize: 13 }} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {}
        }}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <a href={`/gallery/${token}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Preview ↗</a>
      <button className={published ? undefined : 'primary'} type="button" disabled={pending} onClick={() => start(async () => { await setGalleryPublished(galleryId, !published) })}>
        {pending ? '…' : published ? 'Unpublish' : 'Publish'}
      </button>
      {!published && <div style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)' }}>Draft: the link shows nothing until you publish.</div>}
    </div>
  )
}

export function ItemTile({
  galleryId,
  item,
  isCover,
}: {
  galleryId: string
  item: { id: string; name: string; kind: string; size: number; thumbUrl: string | null; url: string }
  isCover: boolean
}) {
  const [pending, start] = useTransition()
  const preview = item.thumbUrl || (item.kind === 'image' && item.size < 6 * 1024 * 1024 ? item.url : null)
  return (
    <div style={{ opacity: pending ? 0.5 : 1 }}>
      <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--bg-card)', border: `1px solid ${isCover ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {preview ? <img src={preview} alt={item.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>{item.kind === 'video' ? '▶ Video' : 'File'}</span>}
        {item.kind === 'video' && preview && <span style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 4 }}>▶</span>}
        {isCover && <span style={{ position: 'absolute', left: 6, top: 6, background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>Cover</span>}
      </div>
      <div style={{ fontSize: 11.5, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ flex: 1 }}>{formatBytes(item.size)}</span>
        {!isCover && item.kind !== 'file' && (
          <button type="button" disabled={pending} onClick={() => start(async () => { await setGalleryCover(galleryId, item.id) })} style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 11, color: 'var(--text-secondary)' }}>
            Make cover
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete “${item.name}”? It is removed from storage too.`)) return
            start(async () => { await deleteGalleryItem(item.id) })
          }}
          style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 11, color: 'var(--text-muted)' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function DeleteGalleryButton({ galleryId }: { galleryId: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm('Delete this whole gallery and every file in it? This cannot be undone.')) return
        start(async () => { await deleteGallery(galleryId) })
      }}
      style={{ border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
    >
      {pending ? 'Deleting…' : 'Delete gallery'}
    </button>
  )
}
