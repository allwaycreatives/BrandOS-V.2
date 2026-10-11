import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import BoardCanvas from './BoardCanvas'
import BoardActions from './BoardActions'
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

  // What each board tile on the canvas shows: the name of the board it opens, and how much is in it.
  const tiled = new Set(cards.filter((c) => c.type === 'board').map((c) => c.content))
  const inner = Object.fromEntries(inside.map((b) => [b.id, { id: b.id, name: b.name, cards: b._count.cards, boards: b._count.children }]))

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

      <BoardCanvas
        boardId={board.id}
        brandSpaceId={params.id}
        readOnly={readOnly}
        inner={inner}
        needsAdopt={!readOnly && inside.some((b) => !tiled.has(b.id))}
        canNest={depth < MAX_BOARD_DEPTH}
        cards={cards.map((c) => ({ id: c.id, type: c.type, content: c.content, meta: c.meta, width: c.width, height: c.height, style: c.style, positionX: c.positionX, positionY: c.positionY }))}
      />
    </div>
  )
}
