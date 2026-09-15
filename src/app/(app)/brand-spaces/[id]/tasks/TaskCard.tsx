'use client'

import { useState, useTransition } from 'react'
import { updateTaskStatus, addTaskComment } from './actions'

type Comment = {
  id: string
  body: string
  createdAt: string | Date
  author: { name: string | null; email: string }
}

type Task = {
  id: string
  title: string
  description: string | null
  fileUrl: string | null
  status: string
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

  function handlePost() {
    if (!draft.trim()) return
    setPosting(true)
    startTransition(async () => {
      await addTaskComment(brandSpaceId, task.id, draft)
      setDraft('')
      setPosting(false)
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
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      {task.description && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{task.description}</div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        {task.assignee && <span>Assigned to {task.assignee.name || task.assignee.email}</span>}
        {task.fileUrl && (
          <a href={task.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            View file
          </a>
        )}
        <button type="button" onClick={() => setShowComments((s) => !s)} style={{ fontSize: 11.5, padding: '3px 9px' }}>
          💬 {comments.length > 0 ? comments.length : ''} {comments.length === 1 ? 'comment' : 'comments'}
        </button>
      </div>

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
