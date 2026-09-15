'use client'

import { useTransition } from 'react'
import { updateTaskStatus } from './actions'

type Task = {
  id: string
  title: string
  description: string | null
  fileUrl: string | null
  status: string
  assignee: { name: string | null; email: string } | null
}

export default function TaskCard({ brandSpaceId, task }: { brandSpaceId: string; task: Task }) {
  const [isPending, startTransition] = useTransition()

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

      <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        {task.assignee && <span>Assigned to {task.assignee.name || task.assignee.email}</span>}
        {task.fileUrl && (
          <a href={task.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            View file
          </a>
        )}
      </div>
    </div>
  )
}
