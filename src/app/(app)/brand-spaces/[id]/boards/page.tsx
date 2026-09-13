import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { addBoardCard } from './actions'
import BoardCanvas from './BoardCanvas'

export default async function BoardsPage({ params }: { params: { id: string } }) {
  const brandSpace = await db.brandSpace.findUnique({ where: { id: params.id } }).catch(() => null)
  if (!brandSpace) notFound()

  const board = await db.board.findFirst({ where: { brandSpaceId: params.id } }).catch(() => null)
  const cards = board
    ? await db.boardCard.findMany({ where: { boardId: board.id } }).catch(() => [])
    : []

  const addWithId = addBoardCard.bind(null, params.id)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace!.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Boards</div>
        <div className="topbar-sub">A freeform space for visual references, moodboards, and campaign ideas. Drag cards to arrange them.</div>
      </div>

      <form action={addWithId} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select name="type" style={{ padding: '9px 12px' }}>
          <option value="note">Note</option>
          <option value="image">Image URL</option>
          <option value="link">Link</option>
        </select>
        <input name="content" required placeholder="Text, image URL, or link" style={{ flex: 1, minWidth: 220 }} />
        <button className="primary" type="submit">Add card</button>
      </form>

      <BoardCanvas
        brandSpaceId={params.id}
        initialCards={cards.map((c) => ({ id: c.id, type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY }))}
      />
    </div>
  )
}
