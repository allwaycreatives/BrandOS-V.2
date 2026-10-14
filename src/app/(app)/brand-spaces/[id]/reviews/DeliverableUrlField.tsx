'use client'

import { useRef, useState } from 'react'
import UploadBar from '@/components/UploadBar'
import { useFileUpload } from '@/lib/useFileUpload'

// A link field with an "Upload image" option, for design proofs that clients can pin comments on.
export default function DeliverableUrlField() {
  const [url, setUrl] = useState('')
  const proof = useFileUpload({ compress: false }) // design proofs stay pixel-perfect
  const busy = proof.uploading
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('Please choose an image. For video or documents, paste a link.')
    if (f.size > 15 * 1024 * 1024) return setErr('Images up to 15 MB. For anything bigger, paste a link.')
    setErr(null)
    const res = await proof.run(f)
    if (res) setUrl(res.url)
  }

  return (
    <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input name="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (YouTube, Drive, Frame.io...) or upload a design" style={{ flex: '1 1 200px' }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Uploading...' : 'Upload image'}</button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      </div>
      {proof.item && proof.item.status !== 'done' && (
        <UploadBar item={proof.item} onCancel={proof.cancel} onRetry={proof.retry} onDismiss={proof.dismiss} />
      )}
      {err && <span style={{ fontSize: 12, color: 'var(--accent-text)' }}>{err}</span>}
    </div>
  )
}
