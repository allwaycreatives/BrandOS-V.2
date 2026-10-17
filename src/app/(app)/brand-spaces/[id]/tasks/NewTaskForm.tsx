'use client'

import { useRef, useState } from 'react'
import UploadBar from '@/components/UploadBar'
import { useFileUpload } from '@/lib/useFileUpload'
import { createTask } from './actions'

export default function NewTaskForm({
  brandSpaceId,
  assigneeOptions,
}: {
  brandSpaceId: string
  assigneeOptions: { id: string; label: string }[]
}) {
  // Attachments keep their original quality (compress: false); you still get progress, retry and cancel.
  const fileUp = useFileUpload({ compress: false })
  const [uploadedName, setUploadedName] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState('')
  const uploading = fileUp.uploading

  const audioUp = useFileUpload({ compress: false })
  const [audioUploadedName, setAudioUploadedName] = useState('')
  const [audioUploadedUrl, setAudioUploadedUrl] = useState('')
  const audioUploading = audioUp.uploading

  async function attach(file: File, retrying = false) {
    setUploadedUrl('')
    const res = retrying ? await fileUp.retry() : await fileUp.run(file)
    if (res) {
      setUploadedUrl(res.url)
      setUploadedName(res.name)
    }
  }

  async function attachAudio(file: File, retrying = false) {
    setAudioUploadedUrl('')
    const res = retrying ? await audioUp.retry() : await audioUp.run(file)
    if (res) {
      setAudioUploadedUrl(res.url)
      setAudioUploadedName(res.name)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) attach(file)
  }

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) attachAudio(file)
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
            {fileUp.item && fileUp.item.status !== 'done' && (
              <div style={{ marginTop: 8, maxWidth: 360 }}>
                <UploadBar item={fileUp.item} onCancel={fileUp.cancel} onRetry={() => attach(null as unknown as File, true)} onDismiss={fileUp.dismiss} />
              </div>
            )}
            {uploadedUrl && !uploading && (
              <div style={{ fontSize: 12, color: 'var(--accent-text)', marginTop: 6 }}>✓ {uploadedName} attached</div>
            )}
          </div>

          <input name="fileLinkFallback" placeholder="Or paste a link to the file instead" />
          <input type="hidden" name="fileUrl" value={uploadedUrl} />

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Large video? Attach just the audio instead so it can be transcribed (optional)
            </div>
            <input type="file" accept="audio/*" onChange={handleAudioFileChange} disabled={audioUploading} />
            {audioUp.item && audioUp.item.status !== 'done' && (
              <div style={{ marginTop: 8, maxWidth: 360 }}>
                <UploadBar item={audioUp.item} onCancel={audioUp.cancel} onRetry={() => attachAudio(null as unknown as File, true)} onDismiss={audioUp.dismiss} />
              </div>
            )}
            {audioUploadedUrl && !audioUploading && (
              <div style={{ fontSize: 12, color: 'var(--accent-text)', marginTop: 6 }}>✓ {audioUploadedName} attached for transcription</div>
            )}
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
