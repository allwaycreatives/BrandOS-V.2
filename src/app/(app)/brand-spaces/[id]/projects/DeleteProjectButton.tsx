'use client'

import { useTransition } from 'react'
import { deleteProject } from './actions'

export default function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm('Delete this project? Its tasks and boards stay in your task list and boards.')) return
        startTransition(async () => {
          await deleteProject(projectId)
        })
      }}
      style={{ border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}
    >
      {isPending ? 'Deleting...' : 'Delete project'}
    </button>
  )
}
