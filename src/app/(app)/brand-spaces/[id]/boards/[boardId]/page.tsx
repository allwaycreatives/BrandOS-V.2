import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import BoardCanvas from './BoardCanvas'
import BoardActions from './BoardActions'

export default async function BoardCanvasPage({ params }: { params: { id: string; boardId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const readOnly = access.role === 'client'

  const board = await db.board.findUnique({ where: { id: params.boardId } }).catch(() => null)
  if (!board || board.brandSpaceId !== params.id) notFound()

  const cards = await db.boardCard.findMany({ where: { boardId: params.boardId } }).catch(() => [])

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}/boards`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← All boards
      </Link>

      <div style={{ marginTop: 8, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 600, margin: 0 }}>{board.name}</h1>
        {!readOnly && <BoardActions brandSpaceId={params.id} boardId={board.id} name={board.name} shareToken={board.shareToken} />}
      </div>

      <BoardCanvas
        boardId={board.id}
        readOnly={readOnly}
        cards={cards.map((c) => ({ id: c.id, type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY }))}
      />
    </div>
  )
}
