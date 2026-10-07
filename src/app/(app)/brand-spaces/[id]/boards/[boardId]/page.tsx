import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import BoardCanvas from './BoardCanvas'
import BoardActions from './BoardActions'
import DeleteBoardButton from '../DeleteBoardButton'
import { createBoard } from '../actions'
import { MAX_BOARD_DEPTH } from '../constants'

const SERIF = "Georgia, 'Times New Roman', serif"

export default async function BoardCanvasPage({ params }: { params: { id: string; boardId: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const readOnly = access.role === 'client'

  const board = await db.board.findUnique({ where: { id: params.boardId } }).catch(() => null)
  if (!board || board.brandSpaceId !== params.id) notFound()

  const cards = await db.boardCard.findMany({ where: { boardId: params.boardId } }).catch(() => [])
  const inside = await db.board
    .findMany({ where: { parentBoardId: board.id }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { cards: true, children: true } } } })
    .catch(() => [])

  // The trail back up: All boards › Parent › This board.
  const trail: { id: string; name: string }[] = []
  let up = board.parentBoardId
  while (up && trail.length < MAX_BOARD_DEPTH + 2) {
    const p = await db.board.findUnique({ where: { id: up }, select: { id: true, name: true, parentBoardId: true, brandSpaceId: true } })
    if (!p || p.brandSpaceId !== params.id) break
    trail.unshift({ id: p.id, name: p.name })
    up = p.parentBoardId
  }
  const depth = trail.length + 1
  const boardsHref = `/brand-spaces/${params.id}/boards`
  const createInside = createBoard.bind(null, params.id)

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Link href={boardsHref}>All boards</Link>
        {trail.map((t) => (
          <span key={t.id} style={{ display: 'contents' }}>
            <span>›</span>
            <Link href={`${boardsHref}/${t.id}`}>{t.name}</Link>
          </span>
        ))}
      </div>

      <div style={{ marginTop: 8, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{board.name}</h1>
        {!readOnly && <BoardActions brandSpaceId={params.id} boardId={board.id} name={board.name} shareToken={board.shareToken} />}
      </div>

      {(inside.length > 0 || (!readOnly && depth < MAX_BOARD_DEPTH)) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Boards inside {board.name}</div>
          {inside.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10, marginBottom: 10 }}>
              {inside.map((b) => (
                <Link key={b.id} href={`${boardsHref}/${b.id}`} className="card" style={{ position: 'relative', paddingTop: readOnly ? 12 : 30 }}>
                  {!readOnly && <DeleteBoardButton brandSpaceId={params.id} boardId={b.id} />}
                  <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {b._count.cards} {b._count.cards === 1 ? 'card' : 'cards'}
                    {b._count.children > 0 ? ` · ${b._count.children} ${b._count.children === 1 ? 'board' : 'boards'} inside` : ''}
                  </div>
                </Link>
              ))}
            </div>
          )}
          {!readOnly && depth < MAX_BOARD_DEPTH && (
            <form action={createInside} style={{ display: 'flex', gap: 8 }}>
              <input type="hidden" name="parentBoardId" value={board.id} />
              <input name="name" required placeholder="New board inside this one" style={{ flex: 1 }} />
              <button type="submit">Add board</button>
            </form>
          )}
        </div>
      )}

      <BoardCanvas
        boardId={board.id}
        readOnly={readOnly}
        cards={cards.map((c) => ({ id: c.id, type: c.type, content: c.content, meta: c.meta, positionX: c.positionX, positionY: c.positionY }))}
      />
    </div>
  )
}
