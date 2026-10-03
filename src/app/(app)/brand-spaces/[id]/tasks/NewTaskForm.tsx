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

  const [audioUploading, setAudioUploading] = useState(false)
  const [audioUploadedName, setAudioUploadedName] = useState('')
  const [audioUploadedUrl, setAudioUploadedUrl] = useState('')
  const [audioError, setAudioError] = useState('')

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

  async function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAudioUploading(true)
    setAudioError('')
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      setAudioUploadedUrl(blob.url)
      setAudioUploadedName(file.name)
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Upload failed — try again.')
    } finally {
      setAudioUploading(false)
    }
  }

  const createWithId = createTask.bind(null, brandSpaceId)

  return (
    <form action={createWithId} className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="qc-row">
        <input name="title" required placeholder="What do you need? e.g. 'A title for our launch video'" className="qc-main" autoComplete="off" />
        <button className="primary qc-go" type="submit" disabled={uploading || audioUploading}>Add task</button>
      </div>

      <details className="more-options">
        <summary>More options: details, a file, or an assignee</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
          <textarea name="description" rows={2} placeholder="Any extra detail (optional)" />

          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Attach a file</div>
            <input type="file" onChange={handleFileChange} disabled={uploading} />
            {uploading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Uploading...</div>}
            {uploadedUrl && !uploading && (
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>✓ {uploadedName} attached</div>
            )}
            {error && <div style={{ fontSize: 12, color: '#e5484d', marginTop: 6 }}>{error}</div>}
          </div>

          <input name="fileLinkFallback" placeholder="Or paste a link to the file instead" />
          <input type="hidden" name="fileUrl" value={uploadedUrl} />

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Large video? Attach just the audio instead so it can be transcribed (optional)
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioFileChange} disabled={audioUploading} />
            {audioUploading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Uploading...</div>}
            {audioUploadedUrl && !audioUploading && (
              <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>✓ {audioUploadedName} attached for transcription</div>
            )}
            {audioError && <div style={{ fontSize: 12, color: '#e5484d', marginTop: 6 }}>{audioError}</div>}
            <input type="hidden" name="audioUrl" value={audioUploadedUrl} />
          </div>

          <select name="assigneeUserId" defaultValue="" aria-label="Assign to">
            <option value="">Unassigned</option>
            {assigneeOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      </details>
    </form>
  )
}
