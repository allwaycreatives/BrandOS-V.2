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
import { normalizeHex, parseColorCard, serializeColorCard } from '@/lib/boardColor'
import { MAX_CARD_SIZE, MIN_SIZE, mergeStyle, parseStyle, styleToJson } from '@/lib/boardStyle'


const CARD_TYPES = ['note', 'heading', 'image', 'link', 'color', 'board']

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
  await db.$transaction([
    db.boardCard.deleteMany({ where: { boardId: { in: ids } } }),
    db.boardCard.deleteMany({ where: { type: 'board', content: { in: ids } } }),
    db.board.deleteMany({ where: { id: { in: ids } } }),
  ])
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

  if (type === 'color') {
    const c = parseColorCard(text)
    if (!normalizeHex(c.hex)) throw new Error('That is not a colour code.')
    text = serializeColorCard(c)
  }

  // A board tile: this creates the new board inside this one, and the tile on the canvas opens it.
  if (type === 'board') {
    const name = text.trim().slice(0, 120)
    if (!name) throw new Error('Please give the board a name.')
    if ((await boardDepth(boardId)) >= MAX_BOARD_DEPTH) throw new Error(`Boards can go ${MAX_BOARD_DEPTH} levels deep.`)
    const made = await db.$transaction(async (tx) => {
      const child = await tx.board.create({ data: { brandSpaceId: board.brandSpaceId, name, parentBoardId: boardId } })
      const tile = await tx.boardCard.create({ data: { boardId, type: 'board', content: child.id, positionX: x, positionY: y } })
      return { child, tile }
    })
    revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards`)
    return { id: made.tile.id, type: 'board', content: made.child.id, meta: null, width: null, height: null, style: null, positionX: x, positionY: y, inner: { id: made.child.id, name: made.child.name, cards: 0, boards: 0 } }
  }

  const card = await db.boardCard.create({ data: { boardId, type, content: text, meta, positionX: x, positionY: y } })
  revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards`)
  return { id: card.id, type: card.type, content: card.content, meta: card.meta, width: card.width, height: card.height, style: card.style, positionX: card.positionX, positionY: card.positionY, inner: null }
}

// Renames the board a tile opens.
export async function renameBoardTile(cardId: string, name: string): Promise<{ name: string }> {
  const card = await cardForEdit(cardId)
  if (card.type !== 'board') throw new Error('That is not a board.')
  const clean = name.trim().slice(0, 120)
  if (!clean) throw new Error('Please give the board a name.')
  const child = await db.board.findUnique({ where: { id: card.content } })
  if (!child || child.parentBoardId !== card.boardId) throw new Error('Board not found.')
  await db.board.update({ where: { id: child.id }, data: { name: clean } })
  return { name: clean }
}

// Boards created before tiles existed sit inside a board without a tile. This gives each one a tile, in a row below the rest.
export async function adoptInnerBoards(boardId: string) {
  const board = await boardForEdit(boardId)
  const [kids, tiles, cards] = await Promise.all([
    db.board.findMany({ where: { parentBoardId: boardId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { cards: true, children: true } } } }),
    db.boardCard.findMany({ where: { boardId, type: 'board' }, select: { content: true } }),
    db.boardCard.findMany({ where: { boardId }, select: { positionY: true } }),
  ])
  const tiled = new Set(tiles.map((t) => t.content))
  const loose = kids.filter((k) => !tiled.has(k.id))
  const baseY = cards.length ? Math.max(...cards.map((c) => c.positionY)) + 160 : 40
  const out = []
  for (let i = 0; i < loose.length; i++) {
    const k = loose[i]
    const tile = await db.boardCard.create({ data: { boardId, type: 'board', content: k.id, positionX: 40 + i * 230, positionY: baseY } })
    out.push({ id: tile.id, type: 'board', content: k.id, meta: null, width: null, height: null, style: null, positionX: tile.positionX, positionY: tile.positionY, inner: { id: k.id, name: k.name, cards: k._count.cards, boards: k._count.children } })
  }
  if (out.length) revalidatePath(`/brand-spaces/${board.brandSpaceId}/boards/${boardId}`)
  return out
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
  if (card.type === 'color') {
    const c = parseColorCard(text)
    if (!normalizeHex(c.hex)) throw new Error('That is not a colour code.')
    text = serializeColorCard(c)
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

// ---- Working with several cards at once ----
// Every one of these checks that the cards really belong to the board named, so an id from elsewhere can never be touched.

async function cardsOfBoard(boardId: string, ids: string[]) {
  const board = await boardForEdit(boardId)
  const unique = Array.from(new Set(ids.filter((i) => typeof i === 'string'))).slice(0, 300)
  const cards = unique.length ? await db.boardCard.findMany({ where: { id: { in: unique }, boardId } }) : []
  return { board, cards }
}

// Saves where a group of cards ended up after being dragged together.
export async function moveBoardCards(boardId: string, moves: { id: string; x: number; y: number }[]) {
  const valid = (moves ?? []).filter((m) => m && Number.isFinite(m.x) && Number.isFinite(m.y) && Math.abs(m.x) < 1e6 && Math.abs(m.y) < 1e6)
  const { cards } = await cardsOfBoard(boardId, valid.map((m) => m.id))
  const ok = new Set(cards.map((c) => c.id))
  await db.$transaction(valid.filter((m) => ok.has(m.id)).map((m) => db.boardCard.update({ where: { id: m.id }, data: { positionX: m.x, positionY: m.y } })))
}

// Saves a card's size (and position, since pulling the left or top edge moves it). height null = follow the content.
export async function resizeBoardCard(boardId: string, cardId: string, rect: { x: number; y: number; w: number; h: number | null }) {
  const { cards } = await cardsOfBoard(boardId, [cardId])
  const card = cards[0]
  if (!card) throw new Error('Card not found.')
  if (![rect.x, rect.y, rect.w].every(Number.isFinite) || (rect.h !== null && !Number.isFinite(rect.h))) return
  const min = MIN_SIZE[card.type] ?? { w: 60, h: 40 }
  const w = Math.min(MAX_CARD_SIZE, Math.max(min.w, rect.w))
  const h = rect.h === null || card.type === 'image' ? null : Math.min(MAX_CARD_SIZE, Math.max(min.h, rect.h))
  await db.boardCard.update({ where: { id: card.id }, data: { positionX: rect.x, positionY: rect.y, width: w, height: h } })
}

// Changes how cards look. A patch value of null puts that choice back to the default.
export async function styleBoardCards(boardId: string, ids: string[], patch: Record<string, unknown>): Promise<{ id: string; style: string | null }[]> {
  const allowed = new Set(['fs', 'b', 'i', 'al', 'color', 'bg', 'title', 'subtitle'])
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch ?? {})) if (allowed.has(k)) clean[k] = v
  const { cards } = await cardsOfBoard(boardId, ids)
  const updates = cards.map((c) => ({ id: c.id, style: styleToJson(mergeStyle(parseStyle(c.style), clean)) }))
  await db.$transaction(updates.map((u) => db.boardCard.update({ where: { id: u.id }, data: { style: u.style } })))
  return updates
}

// Deletes several cards in one go. A board tile takes the board it opens, and everything inside it, with it.
export async function deleteBoardCards(boardId: string, ids: string[]) {
  const { cards } = await cardsOfBoard(boardId, ids)
  if (cards.length === 0) return
  const tileTargets = cards.filter((c) => c.type === 'board').map((c) => c.content)
  const kids = tileTargets.length ? await db.board.findMany({ where: { id: { in: tileTargets }, parentBoardId: boardId }, select: { id: true } }) : []
  const inner: string[] = []
  for (const k of kids) inner.push(...(await boardAndDescendantIds(k.id)))
  await db.$transaction([
    db.boardCard.deleteMany({ where: { boardId: { in: inner } } }),
    db.boardCard.deleteMany({ where: { type: 'board', content: { in: inner } } }),
    db.board.deleteMany({ where: { id: { in: inner } } }),
    db.boardCard.deleteMany({ where: { id: { in: cards.map((c) => c.id) } } }),
  ])
}

export async function deleteBoardCard(cardId: string) {
  const card = await cardForEdit(cardId)
  if (card.type === 'board') {
    // Removing a board tile deletes the board it opens, and everything inside that.
    const child = await db.board.findUnique({ where: { id: card.content } })
    if (child && child.parentBoardId === card.boardId) {
      const ids = await boardAndDescendantIds(child.id)
      await db.$transaction([
        db.boardCard.deleteMany({ where: { boardId: { in: ids } } }),
        db.boardCard.deleteMany({ where: { type: 'board', content: { in: ids } } }),
        db.board.deleteMany({ where: { id: { in: ids } } }),
      ])
      return
    }
  }
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
        // Board tiles are re-made below so that each one opens the COPY of its board, never the original.
        cards: { create: src.cards.filter((c) => c.type !== 'board').map((c) => ({ type: c.type, content: c.content, meta: c.meta, width: c.width, height: c.height, style: c.style, positionX: c.positionX, positionY: c.positionY })) },
      },
    })
    if (depth < MAX_BOARD_DEPTH + 2) {
      const kids = await tx.board.findMany({ where: { parentBoardId: sourceId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
      for (const k of kids) {
        const newKidId = await copyTree(tx, k.id, copy.id, false, depth + 1)
        const tile = src.cards.find((c) => c.type === 'board' && c.content === k.id)
        if (tile) await tx.boardCard.create({ data: { boardId: copy.id, type: 'board', content: newKidId, width: tile.width, height: tile.height, style: tile.style, positionX: tile.positionX, positionY: tile.positionY } })
      }
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
