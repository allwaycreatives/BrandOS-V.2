'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBoard } from './actions'

export default function DeleteBoardButton({ brandSpaceId, boardId }: { brandSpaceId: string; boardId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm('Delete this board and everything on it?')) return
        startTransition(async () => {
          await deleteBoard(brandSpaceId, boardId)
          router.refresh()
        })
      }}
      disabled={isPending}
      style={{ position: 'absolute', top: 10, right: 10, padding: '2px 8px', fontSize: 11 }}
    >
      {isPending ? '...' : '×'}
    </button>
  )
}
