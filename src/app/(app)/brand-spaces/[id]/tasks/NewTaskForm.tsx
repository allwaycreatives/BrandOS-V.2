'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { createTask } from './actions'

export default function NewTaskForm({
  brandSpaceId,
  assigneeOptions,
}: {
  brandSpaceId: string
  assigneeOptions: { id: string; label: string }[]
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadedName, setUploadedName] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      setUploadedUrl(blob.url)
      setUploadedName(file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed — try again.')
    } finally {
      setUploading(false)
    }
  }

  const createWithId = createTask.bind(null, brandSpaceId)

  return (
    <form action={createWithId} className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input name="title" required placeholder="What do you need? e.g. 'A title for our launch video'" />
      <textarea name="description" rows={2} placeholder="Any extra detail (optional)" />

      <div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Attach a file</div>
        <input ref={fileInputRef} type="file" onChange={handleFileChange} disabled={uploading} style={{ fontSize: 12.5 }} />
        {uploading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Uploading...</div>}
        {uploadedUrl && !uploading && (
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>✓ {uploadedName} attached</div>
        )}
        {error && <div style={{ fontSize: 12, color: '#e5484d', marginTop: 6 }}>{error}</div>}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>— or —</div>
      <input name="fileLinkFallback" placeholder="Paste a link instead, if that's easier" />
      <input type="hidden" name="fileUrl" value={uploadedUrl} />

      <select name="assigneeUserId" defaultValue="">
        <option value="">Unassigned</option>
        {assigneeOptions.map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </select>

      <button className="primary" type="submit" disabled={uploading}>Add task</button>
    </form>
  )
}
