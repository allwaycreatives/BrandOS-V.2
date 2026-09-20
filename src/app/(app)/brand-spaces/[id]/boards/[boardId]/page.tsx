import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { addBoardCard } from '../actions'
import BoardCanvas from './BoardCanvas'

export default async function BoardCanvasPage({ params }: { params: { id: string; boardId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()

  const board = await db.board.findUnique({ where: { id: params.boardId } }).catch(() => null)
  if (!board || board.brandSpaceId !== params.id) notFound()

  const cards = await db.boardCard.findMany({ where: { boardId: params.boardId } }).catch(() => [])
  const addWithIds = addBoardCard.bind(null, params.id, params.boardId)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/boards`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← All boards
      </Link>

      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <div className="topbar-greeting">{board.name}</div>
      </div>

      <form action={addWithIds} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select name="type" style={{ padding: '9px 12px' }}>
          <option value="note">Note</option>
          <option value="image">Image URL</option>
          <option value="link">Link</option>
        </select>
        <input name="content" required placeholder="Text, image URL, or link" style={{ flex: 1, minWidth: 220 }} />
        <button className="primary" type="submit">Add card</button>
      </form>

      <BoardCanvas
        cards={cards.map((c) => ({ id: c.id, type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY }))}
      />
    </div>
  )
}
