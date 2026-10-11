'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'

// Copies a shared board (and every card on it) into the signed-in person's own workspace.
// The shared link is the permission. If they have no brand yet, one is created so they land somewhere real.
export async function copySharedBoard(token: string, brandSpaceId?: string): Promise<{ brandSpaceId: string; boardId: string } | { error: string }> {
  if (!token) return { error: 'This link is not valid.' }
  const source = await db.board.findUnique({ where: { shareToken: token }, include: { cards: true } })
  if (!source) return { error: 'This board is no longer shared.' }

  const { user, organizationId } = await getOrCreateCurrentUser()
  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')

  let targetId = brandSpaceId && brands.some((b) => b.id === brandSpaceId) ? brandSpaceId : brands[0]?.id
  if (!targetId) {
    const created = await db.brandSpace.create({ data: { name: 'My first brand', organizationId } })
    targetId = created.id
  }

  const copy = await db.board.create({
    data: {
      brandSpaceId: targetId,
      name: source.name,
      cards: { create: source.cards.filter((c) => c.type !== 'board').map((c) => ({ type: c.type, content: c.content, width: c.width, height: c.height, style: c.style, positionX: c.positionX, positionY: c.positionY })) },
    },
  })
  return { brandSpaceId: targetId, boardId: copy.id }
}
