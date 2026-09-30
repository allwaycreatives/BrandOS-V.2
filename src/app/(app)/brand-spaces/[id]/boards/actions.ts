'use server'

import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { TEMPLATES } from './templates'

const CARD_TYPES = ['note', 'heading', 'image', 'link', 'color']

// Clients can view boards but not change them.
async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to edit boards here.')
}

async function boardForEdit(boardId: string) {
  const board = await db.board.findUnique({ where: { id: boardId } })
  if (!board) throw new Error('Board not found.')
  await requireEdit(board.brandSpaceId)
  return board
}

async function cardForEdit(cardId: string) {
  const card = await db.boardCard.findUnique({ where: { id: cardId }, include: { board: true } })
  if (!card) throw new Error('Card not found.')
  await requireEdit(card.board.brandSpaceId)
  return card
}

export async function createBoard(brandSpaceId: string, formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  if (!name) return
  await requireEdit(brandSpaceId)
  await db.board.create({ data: { brandSpaceId, name } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
}

export async function deleteBoard(brandSpaceId: string, boardId: string) {
  const board = await boardForEdit(boardId)
  if (board.brandSpaceId !== brandSpaceId) throw new Error('Board not found.')
  await db.boardCard.deleteMany({ where: { boardId } })
  await db.board.delete({ where: { id: boardId } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
}

export async function addBoardCardAt(boardId: string, type: string, content: string, x: number, y: number) {
  const board = await boardForEdit(boardId)
  if (!CARD_TYPES.includes(type)) throw new Error('Unknown card type.')
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Bad position.')
  const card = await db.boardCard.create({
    data: { boardId, type, content: String(content).slice(0, 5000), positionX: x, positionY: y },
  })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards`)
  return { id: card.id, type: card.type, content: card.content, positionX: card.positionX, positionY: card.positionY }
}

export async function updateBoardCard(cardId: string, content: string) {
  await cardForEdit(cardId)
  await db.boardCard.update({ where: { id: cardId }, data: { content: String(content).slice(0, 5000) } })
}

export async function moveBoardCard(cardId: string, x: number, y: number) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  await cardForEdit(cardId)
  await db.boardCard.update({ where: { id: cardId }, data: { positionX: x, positionY: y } })
}

export async function deleteBoardCard(cardId: string) {
  await cardForEdit(cardId)
  await db.boardCard.delete({ where: { id: cardId } })
}

// Copies a board and every card on it, so a good setup can be reused over and over.
export async function duplicateBoard(boardId: string) {
  const board = await boardForEdit(boardId)
  const cards = await db.boardCard.findMany({ where: { boardId } })
  const copy = await db.board.create({
    data: {
      brandSpaceId: board.brandSpaceId,
      name: `${board.name} (copy)`,
      cards: { create: cards.map((c) => ({ type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY })) },
    },
  })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards`)
  return { boardId: copy.id }
}

// Creates the template's boards pre-filled with example content.
export async function createBoardsFromTemplate(brandSpaceId: string, templateKey: string) {
  const template = TEMPLATES[templateKey]
  if (!template) throw new Error('Unknown template.')
  await requireEdit(brandSpaceId)

  // The list shows newest first, so create in reverse to keep "01" at the top.
  let firstId = ''
  for (let i = template.boards.length - 1; i >= 0; i--) {
    const spec = template.boards[i]
    const board = await db.board.create({
      data: {
        brandSpaceId,
        name: spec.name,
        cards: { create: spec.cards.map((c) => ({ type: c.type, content: c.content, positionX: c.x, positionY: c.y })) },
      },
    })
    if (i === 0) firstId = board.id
  }
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
  return { boardId: firstId }
}

// Anyone with the link can view (not edit) the board.
export async function enableBoardShare(boardId: string) {
  const board = await boardForEdit(boardId)
  if (board.shareToken) return { token: board.shareToken }
  const token = randomBytes(18).toString('base64url')
  await db.board.update({ where: { id: boardId }, data: { shareToken: token } })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards/${boardId}`)
  return { token }
}

export async function disableBoardShare(boardId: string) {
  const board = await boardForEdit(boardId)
  await db.board.update({ where: { id: boardId }, data: { shareToken: null } })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards/${boardId}`)
}
