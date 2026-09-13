'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

async function getOrCreateBoard(brandSpaceId: string) {
  const existing = await db.board.findFirst({ where: { brandSpaceId } })
  if (existing) return existing
  return db.board.create({ data: { brandSpaceId, name: 'Moodboard' } })
}

export async function addBoardCard(brandSpaceId: string, formData: FormData) {
  const type = String(formData.get('type') || 'note')
  const content = String(formData.get('content') || '').trim()
  if (!content) return

  const board = await getOrCreateBoard(brandSpaceId)

  await db.boardCard.create({
    data: {
      boardId: board.id,
      type,
      content,
      positionX: 40 + Math.random() * 120,
      positionY: 40 + Math.random() * 120,
    },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
}

export async function moveBoardCard(cardId: string, x: number, y: number) {
  await db.boardCard.update({ where: { id: cardId }, data: { positionX: x, positionY: y } })
}

export async function deleteBoardCard(brandSpaceId: string, cardId: string) {
  await db.boardCard.delete({ where: { id: cardId } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
}
