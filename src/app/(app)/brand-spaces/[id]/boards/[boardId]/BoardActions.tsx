'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateBoard, enableBoardShare, disableBoardShare } from '../actions'
import SaveTemplateButton from '@/components/SaveTemplateButton'

export default function BoardActions({ brandSpaceId, boardId, name, shareToken }: { brandSpaceId: string; boardId: string; name: string; shareToken: string | null }) {
  const router = useRouter()
  const [token, setToken] = useState(shareToken)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const link = token && typeof window !== 'undefined' ? `${window.location.origin}/share/board/${token}` : ''

  function duplicate() {
    startTransition(async () => {
      const { boardId: newId } = await duplicateBoard(boardId)
      router.push(`/brand-spaces/${brandSpaceId}/boards/${newId}`)
    })
  }

  function share() {
    setOpen(true)
    if (token) return
    startTransition(async () => {
      const res = await enableBoardShare(boardId)
      setToken(res.token)
    })
  }

  function stopSharing() {
    startTransition(async () => {
      await disableBoardShare(boardId)
      setToken(null)
      setOpen(false)
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {}
  }

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
      <button type="button" onClick={duplicate} disabled={isPending}>Duplicate</button>
      <SaveTemplateButton kind="board" sourceId={boardId} defaultName={name} />
      <button type="button" className="primary" onClick={share} disabled={isPending}>Share</button>
      {open && (
        <div className="card popover">
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>Share this board</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Anyone with this link can view the board. They cannot edit it.
          </div>
          {token ? (
            <>
              <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ width: '100%', fontSize: 12, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                <button type="button" className="primary" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
                <button type="button" onClick={stopSharing} disabled={isPending}>Stop sharing</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Creating link...</div>
          )}
          <button type="button" onClick={() => setOpen(false)} style={{ marginTop: 10, border: 'none', background: 'transparent', fontSize: 12, color: 'var(--text-muted)', padding: 0 }}>Close</button>
        </div>
      )}
    </div>
  )
}
