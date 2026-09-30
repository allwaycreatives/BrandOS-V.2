'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateBoard } from './actions'

export default function DuplicateBoardButton({ boardId }: { boardId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        startTransition(async () => {
          await duplicateBoard(boardId)
          router.refresh()
        })
      }}
      disabled={isPending}
      style={{ position: 'absolute', top: 10, right: 38, padding: '2px 8px', fontSize: 11 }}
    >
      {isPending ? '...' : 'Duplicate'}
    </button>
  )
}
