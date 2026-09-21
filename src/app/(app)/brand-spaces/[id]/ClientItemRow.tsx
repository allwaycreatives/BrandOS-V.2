'use client'

import { useState, useTransition } from 'react'
import { addComment } from './commentActions'

type Comment = {
  id: string
  body: string
  createdAt: string | Date
  author: { name: string | null; email: string }
}

export default function ClientItemRow({
  brandSpaceId,
  objectType,
  objectId,
  title,
  subtitle,
  statusLabel,
  description,
  comments,
}: {
  brandSpaceId: string
  objectType: string
  objectId: string
  title: string
  subtitle?: string
  statusLabel: string
  description?: string | null
  comments: Comment[]
}) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handlePost() {
    if (!draft.trim()) return
    setPosting(true)
    startTransition(async () => {
      await addComment(brandSpaceId, objectType, objectId, draft)
      setDraft('')
      setPosting(false)
    })
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 13.5 }}
      >
        <span>
          {title} {subtitle && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>({subtitle})</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{statusLabel}</span>
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>{expanded ? 'Hide' : 'Show more'}</span>
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingLeft: 4 }}>
          {description && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{description}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {comments.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No comments yet — ask a question or leave a note.</div>
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
              placeholder="Add a comment..."
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePost()
              }}
            />
            <button className="primary" onClick={handlePost} disabled={posting || isPending}>
              {posting ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
