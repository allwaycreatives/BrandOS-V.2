import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import BoardCanvas from '@/app/(app)/brand-spaces/[id]/boards/[boardId]/BoardCanvas'

// Public, view-only page for a board someone chose to share.
export default async function SharedBoardPage({ params }: { params: { token: string } }) {
  const board = await db.board
    .findUnique({ where: { shareToken: params.token }, include: { cards: true } })
    .catch(() => null)
  if (!board) notFound()

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 600, margin: 0 }}>{board.name}</h1>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          View only · Made with <Link href="/" style={{ color: 'var(--accent)' }}>Brand OS</Link>
        </div>
      </div>
      <BoardCanvas
        boardId={board.id}
        readOnly
        cards={board.cards.map((c) => ({ id: c.id, type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY }))}
      />
    </main>
  )
}
