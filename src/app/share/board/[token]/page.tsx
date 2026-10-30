import Link from 'next/link'
import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'
import BoardCanvas from '@/app/(app)/brand-spaces/[id]/boards/[boardId]/BoardCanvas'
import CopyBoardButton from './CopyBoardButton'

const SERIF = "Georgia, 'Times New Roman', serif"

// Public, view-only page for a board someone chose to share. Anyone can copy it into their own workspace.
export default async function SharedBoardPage({ params }: { params: { token: string } }) {
  const board = await db.board
    .findUnique({ where: { shareToken: params.token }, include: { cards: true } })
    .catch(() => null)
  if (!board) notFound()

  const { userId } = auth()
  let brands: { id: string; name: string }[] = []
  if (userId) {
    const { user, organizationId } = await getOrCreateCurrentUser()
    brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client').map((b) => ({ id: b.id, name: b.name }))
  }
  const back = encodeURIComponent(`/share/board/${params.token}`)

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><ThemeToggle /></div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, margin: 0 }}>{board.name}</h1>
        {userId ? (
          <CopyBoardButton token={params.token} brands={brands} />
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href={`/sign-up?redirect_url=${back}`}><button type="button" className="primary">Use this board, free</button></Link>
            <Link href={`/sign-in?redirect_url=${back}`} style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>I have an account</Link>
          </div>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>
        View only · Made with <Link href="/" style={{ color: 'var(--accent-text)' }}>Brand Console</Link>. Copy it to make it your own.
      </div>
      <BoardCanvas
        boardId={board.id}
        readOnly
        cards={board.cards.filter((c) => c.type !== 'board').map((c) => ({ id: c.id, type: c.type, content: c.content, meta: c.meta, width: c.width, height: c.height, style: c.style, positionX: c.positionX, positionY: c.positionY }))}
      />
    </main>
  )
}
