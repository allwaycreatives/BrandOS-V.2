import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { createBoard } from './actions'
import DeleteBoardButton from './DeleteBoardButton'

export default async function BoardsListPage({ params }: { params: { id: string } }) {
  const access = await assertBrandSpaceAccess(params.id)
  if (!access) notFound()
  const { brandSpace } = access

  const boards = await db.board
    .findMany({
      where: { brandSpaceId: params.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { cards: true } } },
    })
    .catch(() => [])

  const createWithId = createBoard.bind(null, params.id)

  return (
    <div>
      <Link href={`/brand-spaces/${params.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        ← {brandSpace.name}
      </Link>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div className="topbar-greeting">Boards</div>
        <div className="topbar-sub">Separate spaces for different kinds of visual thinking — a shot list, location scouting, mood, wardrobe, whatever the work needs.</div>
      </div>

      <form action={createWithId} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input name="name" required placeholder="Board name — e.g. 'Shot List' or 'Mood & Tone'" style={{ flex: 1 }} />
        <button className="primary" type="submit">Create board</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {boards.length === 0 && (
          <div className="card-empty">
            No boards yet — create one above to start pinning up ideas, references, and visuals.
          </div>
        )}
        {boards.map((board) => (
          <Link key={board.id} href={`/brand-spaces/${params.id}/boards/${board.id}`} className="card" style={{ position: 'relative' }}>
            <DeleteBoardButton brandSpaceId={params.id} boardId={board.id} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{board.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              {board._count.cards} {board._count.cards === 1 ? 'card' : 'cards'}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
