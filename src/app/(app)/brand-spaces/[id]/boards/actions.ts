'use server'

import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { assertBrandSpaceAccess } from '@/lib/auth'
import type { Prisma } from '@prisma/client'
import { TEMPLATES } from './templates'
import { safeUrl } from '@/lib/embed'
import { getLinkPreview, metaToJson } from '@/lib/linkPreview'
import { MAX_BOARD_DEPTH } from './constants'


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
  const name = String(formData.get('name') || '').trim().slice(0, 120)
  if (!name) return
  await requireEdit(brandSpaceId)

  // Optional: create it inside another board of the same brand.
  const parentId = String(formData.get('parentBoardId') || '').trim()
  let parentBoardId: string | null = null
  if (parentId) {
    const parent = await db.board.findUnique({ where: { id: parentId } })
    if (!parent || parent.brandSpaceId !== brandSpaceId) return
    if ((await boardDepth(parent.id)) >= MAX_BOARD_DEPTH) return
    parentBoardId = parent.id
  }

  await db.board.create({ data: { brandSpaceId, name, parentBoardId } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
  if (parentBoardId) revalidatePath(`/brand-spaces/${brandSpaceId}/boards/${parentBoardId}`)
}

// How many levels deep a board sits: a top-level board is 1.
async function boardDepth(boardId: string): Promise<number> {
  let depth = 1
  let current = await db.board.findUnique({ where: { id: boardId }, select: { parentBoardId: true } })
  while (current?.parentBoardId && depth < 20) {
    depth++
    current = await db.board.findUnique({ where: { id: current.parentBoardId }, select: { parentBoardId: true } })
  }
  return depth
}

// The board plus every board inside it, at any depth.
async function boardAndDescendantIds(boardId: string): Promise<string[]> {
  const all = [boardId]
  let frontier = [boardId]
  while (frontier.length > 0 && all.length < 500) {
    const kids = await db.board.findMany({ where: { parentBoardId: { in: frontier } }, select: { id: true } })
    frontier = kids.map((k) => k.id).filter((id) => !all.includes(id))
    all.push(...frontier)
  }
  return all
}

// Deletes the board, its cards, and every board inside it. All or nothing.
export async function deleteBoard(brandSpaceId: string, boardId: string) {
  const board = await boardForEdit(boardId)
  if (board.brandSpaceId !== brandSpaceId) throw new Error('Board not found.')
  const ids = await boardAndDescendantIds(boardId)
  await db.$transaction([db.boardCard.deleteMany({ where: { boardId: { in: ids } } }), db.board.deleteMany({ where: { id: { in: ids } } })])
  revalidatePath(`/brand-spaces/${brandSpaceId}/boards`)
  if (board.parentBoardId) revalidatePath(`/brand-spaces/${brandSpaceId}/boards/${board.parentBoardId}`)
}

export async function addBoardCardAt(boardId: string, type: string, content: string, x: number, y: number) {
  const board = await boardForEdit(boardId)
  if (!CARD_TYPES.includes(type)) throw new Error('Unknown card type.')
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Bad position.')

  let text = String(content).slice(0, 5000)
  let meta: string | null = null
  if (type === 'link') {
    const url = safeUrl(text)
    if (!url) throw new Error('That does not look like a link.')
    text = url
    meta = metaToJson(await getLinkPreview(url))
  }

  const card = await db.boardCard.create({ data: { boardId, type, content: text, meta, positionX: x, positionY: y } })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards`)
  return { id: card.id, type: card.type, content: card.content, meta: card.meta, positionX: card.positionX, positionY: card.positionY }
}

// Returns the card's saved link preview (if it is a link), so the screen can update without a reload.
export async function updateBoardCard(cardId: string, content: string): Promise<{ content: string; meta: string | null }> {
  const card = await cardForEdit(cardId)
  let text = String(content).slice(0, 5000)
  let meta: string | null = card.meta
  if (card.type === 'link') {
    const url = safeUrl(text)
    if (!url) throw new Error('That does not look like a link.')
    text = url
    meta = metaToJson(await getLinkPreview(url))
  }
  await db.boardCard.update({ where: { id: cardId }, data: { content: text, meta } })
  return { content: text, meta }
}

// Fills in the thumbnail for a link card that was made before previews existed (or whose first try found nothing).
export async function refreshLinkPreview(cardId: string): Promise<string | null> {
  const card = await cardForEdit(cardId)
  if (card.type !== 'link') return card.meta
  const url = safeUrl(card.content)
  const meta = metaToJson(url ? await getLinkPreview(url) : {})
  await db.boardCard.update({ where: { id: cardId }, data: { meta } })
  return meta
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

// Copies a board, its cards, and every board inside it, so a good setup can be reused over and over.
export async function duplicateBoard(boardId: string) {
  const board = await boardForEdit(boardId)

  async function copyTree(tx: Prisma.TransactionClient, sourceId: string, parentBoardId: string | null, isRoot: boolean, depth: number): Promise<string> {
    const src = await tx.board.findUnique({ where: { id: sourceId }, include: { cards: true } })
    if (!src) throw new Error('Board not found.')
    const copy = await tx.board.create({
      data: {
        brandSpaceId: src.brandSpaceId,
        parentBoardId,
        name: isRoot ? `${src.name} (copy)` : src.name,
        cards: { create: src.cards.map((c) => ({ type: c.type, content: c.content, meta: c.meta, positionX: c.positionX, positionY: c.positionY })) },
      },
    })
    if (depth < MAX_BOARD_DEPTH + 2) {
      const kids = await tx.board.findMany({ where: { parentBoardId: sourceId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
      for (const k of kids) await copyTree(tx, k.id, copy.id, false, depth + 1)
    }
    return copy.id
  }

  // The copy of a board that lives inside another board is placed beside the original.
  const copyId = await db.$transaction((tx) => copyTree(tx, boardId, board.parentBoardId, true, 1), { timeout: 30000, maxWait: 10000 })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards`)
  if (board.parentBoardId) revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards/${board.parentBoardId}`)
  return { boardId: copyId }
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
