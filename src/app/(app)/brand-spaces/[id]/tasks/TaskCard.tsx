'use client'

import { useState, useTransition } from 'react'
import { updateTaskStatus, addTaskComment, transcribeAndReview, suggestClips } from './actions'

type Comment = {
  id: string
  body: string
  createdAt: string | Date
  author: { name: string | null; email: string }
}

type ClipSuggestion = { startTime: string; endTime: string; reason: string; quote: string }

type Task = {
  id: string
  title: string
  description: string | null
  fileUrl: string | null
  audioUrl: string | null
  status: string
  transcript: string | null
  aiFeedback: string | null
  clipSuggestions: unknown
  assignee: { name: string | null; email: string } | null
}

export default function TaskCard({
  brandSpaceId,
  task,
  comments,
}: {
  brandSpaceId: string
  task: Task
  comments: Comment[]
}) {
  const [isPending, startTransition] = useTransition()
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeError, setTranscribeError] = useState('')
  const [showTranscript, setShowTranscript] = useState(false)
  const [findingClips, setFindingClips] = useState(false)
  const [clipsError, setClipsError] = useState('')

  const clips: ClipSuggestion[] = Array.isArray(task.clipSuggestions) ? (task.clipSuggestions as ClipSuggestion[]) : []

  function handlePost() {
    if (!draft.trim()) return
    setPosting(true)
    startTransition(async () => {
      await addTaskComment(brandSpaceId, task.id, draft)
      setDraft('')
      setPosting(false)
    })
  }

  function handleTranscribe() {
    setTranscribing(true)
    setTranscribeError('')
    startTransition(async () => {
      try {
        await transcribeAndReview(brandSpaceId, task.id)
      } catch (err) {
        setTranscribeError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setTranscribing(false)
      }
    })
  }

  function handleSuggestClips() {
    setFindingClips(true)
    setClipsError('')
    startTransition(async () => {
      try {
        await suggestClips(brandSpaceId, task.id)
      } catch (err) {
        setClipsError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setFindingClips(false)
      }
    })
  }

  return (
    <div className="card" style={{ opacity: isPending ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
        <select
          value={task.status}
          disabled={isPending}
          onChange={(e) => startTransition(() => updateTaskStatus(brandSpaceId, task.id, e.target.value))}
          style={{ fontSize: 11.5, padding: '4px 8px' }}
        >
          <option value="open">Waiting to start</option>
          <option value="in_progress">Working on it</option>
          <option value="done">Done!</option>
        </select>
      </div>

      {task.description && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{task.description}</div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        {task.assignee && <span>Assigned to {task.assignee.name || task.assignee.email}</span>}
        {task.fileUrl && (
          <a href={task.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>
            View file
          </a>
        )}
        <button type="button" onClick={() => setShowComments((s) => !s)} style={{ fontSize: 11.5, padding: '3px 9px' }}>
          💬 {comments.length > 0 ? comments.length : ''} {comments.length === 1 ? 'comment' : 'comments'}
        </button>
        {(task.fileUrl || task.audioUrl) && !task.aiFeedback && (
          <button type="button" onClick={handleTranscribe} disabled={transcribing} style={{ fontSize: 11.5, padding: '3px 9px' }}>
            {transcribing ? 'Transcribing...' : '🎬 Transcribe & review'}
          </button>
        )}
        {(task.fileUrl || task.audioUrl) && clips.length === 0 && (
          <button type="button" onClick={handleSuggestClips} disabled={findingClips} style={{ fontSize: 11.5, padding: '3px 9px' }}>
            {findingClips ? 'Finding clips...' : '✂️ Suggest clips'}
          </button>
        )}
      </div>

      {transcribeError && <div style={{ fontSize: 12, color: '#e5484d', marginTop: 8 }}>{transcribeError}</div>}
      {clipsError && <div style={{ fontSize: 12, color: '#e5484d', marginTop: 8 }}>{clipsError}</div>}

      {task.aiFeedback && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
            AI feedback on the hook & structure
          </div>
          <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{task.aiFeedback}</div>
          {task.transcript && (
            <button
              type="button"
              onClick={() => setShowTranscript((s) => !s)}
              style={{ fontSize: 11, padding: '3px 9px', marginTop: 10 }}
            >
              {showTranscript ? 'Hide transcript' : 'Show full transcript'}
            </button>
          )}
          {showTranscript && task.transcript && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 8, whiteSpace: 'pre-wrap' }}>
              {task.transcript}
            </div>
          )}
        </div>
      )}

      {clips.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--accent-text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>
            Suggested clips
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {clips.map((clip, i) => (
              <div key={i} style={{ padding: 10, borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', marginBottom: 4 }}>
                  {clip.startTime} – {clip.endTime}
                </div>
                <div style={{ fontSize: 12.5, marginBottom: 4 }}>{clip.reason}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{clip.quote}"</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showComments && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
            {comments.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                No questions yet — ask something here instead of over chat, so the answer stays with the task.
              </div>
            )}
            {comments.map((c) => (
              <div key={c.id} style={{ fontSize: 12.5 }}>
                <span style={{ fontWeight: 600 }}>{c.author.name || c.author.email}</span>{' '}
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {new Date(c.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
                <div>{c.body}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask a clarifying question..."
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePost()
              }}
            />
            <button className="primary" onClick={handlePost} disabled={posting}>
              {posting ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
