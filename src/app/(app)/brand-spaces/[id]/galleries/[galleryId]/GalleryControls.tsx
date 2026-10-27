'use client'

import { useState, useTransition } from 'react'
import { deleteGallery, setGalleryPublished } from '../actions'

export function ShareBox({ galleryId, token, published }: { galleryId: string; token: string; published: boolean }) {
  // token is the part of the address after /gallery/ (the readable link if there is one, otherwise the private code)
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
