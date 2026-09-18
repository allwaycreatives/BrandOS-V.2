'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createBoard(brandSpaceId: string, formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  if (!name) return

  await db.board.create({ data: { brandSpaceId, name } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
}

export async function deleteBoard(brandSpaceId: string, boardId: string) {
  await db.boardCard.deleteMany({ where: { boardId } })
  await db.board.delete({ where: { id: boardId } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
}

export async function addBoardCard(brandSpaceId: string, boardId: string, formData: FormData) {
  const type = String(formData.get('type') || 'note')
  const content = String(formData.get('content') || '').trim()
  if (!content) return

  await db.boardCard.create({
    data: {
      boardId,
      type,
      content,
      positionX: 40 + Math.random() * 160,
      positionY: 40 + Math.random() * 160,
    },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/boards/${boardId}`)
}

export async function moveBoardCard(cardId: string, x: number, y: number) {
  await db.boardCard.update({ where: { id: cardId }, data: { positionX: x, positionY: y } })
}

export async function deleteBoardCard(cardId: string) {
  await db.boardCard.delete({ where: { id: cardId } })
}
