'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import UploadBar, { type UploadView } from '@/components/UploadBar'
import TodoCard from './TodoCard'
import ColorCard, { COLOR_PALETTE } from './ColorCard'
import CanvasScrollbars from './CanvasScrollbars'
import LinesLayer, { LineToolbar, type LineItem, type DraftLine } from './LinesLayer'
import { fitDrawing } from '@/lib/boardDrawing'
import { healLine, parseLine, resolveLine, serializeLine, type Box, type LineData } from '@/lib/boardLines'
import TableCard, { DEFAULT_TABLE } from './TableCard'
import DocumentCard from './DocumentCard'
import ColumnCard from './ColumnCard'
import SketchCard, { DRAWING_INKS } from './SketchCard'
import { AudioCard, MapCard, VideoCard, videoSource } from './MediaCards'
import { Icons } from './BoardIcons'
import { friendlyUploadError, isImageFile, uploadFile } from '@/lib/uploadFile'
import { useRouter } from 'next/navigation'
import {
  addBoardCardAt,
  moveBoardCards,
  deleteBoardCards,
  updateBoardCard,
  deleteBoardCard,
  refreshLinkPreview,
  renameBoardTile,
  adoptInnerBoards,
  resizeBoardCard,
  styleBoardCards,
} from '../actions'
import BoardInspector from './BoardInspector'
import BoardPrompt from './BoardPrompt'
import { movedEnough, normalizeRect, resizeRect, selectOnDown, type Handle, type Rect } from '@/lib/boardGeometry'
import { DEFAULT_FS, MAX_CARD_SIZE, MIN_SIZE, mergeStyle, parseStyle, readableText, styleToJson, type CardStyle } from '@/lib/boardStyle'

type Card = {
  id: string
  type: string
  content: string
  meta: string | null
  width: number | null
  height: number | null
  style: string | null
  positionX: number
  positionY: number
}
type BoardUpload = UploadView & { id: string; x: number; y: number; preview: string }
type Inner = { id: string; name: string; cards: number; boards: number }
type Meta = { title?: string; image?: string; kind?: string; site?: string }

type Drag =
  | { kind: 'cards'; ids: string[]; startX: number; startY: number; origin: Map<string, { x: number; y: number }>; dx: number; dy: number; moved: boolean; clickedId: string; additive: boolean; onUp: 'collapse' | 'remove' | null }
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'marquee'; sx: number; sy: number; additive: boolean; base: Set<string>; moved: boolean }
  | { kind: 'draw' }
  | { kind: 'newLine'; from: string | null; sx: number; sy: number }
  | { kind: 'lineEnd'; id: string; end: 'a' | 'b' }
  | { kind: 'resize'; id: string; handle: Handle; start: Rect; hadHeight: boolean; startX: number; startY: number; last: Rect }

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5
const WIDTH: Record<string, number> = { note: 210, heading: 320, image: 220, link: 260, color: 200, board: 200, todo: 250, sketch: 260, document: 240, table: 340, column: 280, comment: 210, audio: 280, video: 360, map: 320, drawing: 260 }
// These keep their proportions or follow their own content, so only their width can be dragged.
const WIDTH_ONLY = new Set(['image', 'sketch', 'drawing', 'video', 'map', 'audio', 'table', 'document'])
const SERIF = "Georgia, 'Times New Roman', serif"
const PAPER: React.CSSProperties = {
  background: '#ffffff',
  color: '#1a1a1a',
  borderRadius: 6,
  boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.25)',
}
// Milanote-style: a picture floats on the board with no white card around it.
const IMAGE_FRAME: React.CSSProperties = { background: 'transparent', boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }
const CURSOR: Record<Handle, string> = { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }

function parseMeta(raw: string | null): Meta {
  if (!raw) return {}
  try {
    const m = JSON.parse(raw)
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Link cards stay clean, like Milanote: a big picture and "From Pinterest", not the page's long title.
const VISUAL_SITES = /(^|\.)(pinterest\.[a-z.]+|pin\.it|instagram\.com|tiktok\.com|behance\.net|dribbble\.com|unsplash\.com|flickr\.com|vsco\.co|are\.na)$/i
const SITE_NAMES: [RegExp, string][] = [
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/i, 'Pinterest'],
  [/(^|\.)instagram\.com$/i, 'Instagram'],
  [/(^|\.)tiktok\.com$/i, 'TikTok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/i, 'YouTube'],
  [/(^|\.)vimeo\.com$/i, 'Vimeo'],
  [/(^|\.)behance\.net$/i, 'Behance'],
  [/(^|\.)dribbble\.com$/i, 'Dribbble'],
  [/(^|\.)unsplash\.com$/i, 'Unsplash'],
]

function linkHost(url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function siteLabel(url: string, metaSite?: string) {
  const host = linkHost(url)
  for (const [re, name] of SITE_NAMES) if (re.test(host)) return name
  return metaSite || hostOf(url)
}

// Pinterest hands out tiny thumbnails (236 px wide). Ask for the 736 px version so big cards stay sharp.
function sharpImage(url: string) {
  return url.replace(/(i\.pinimg\.com\/)\d+x\d*(?:_[A-Z]+)?\//, '$1736x/')
}

// When a note is clicked, find which character the click landed on, so the cursor can go exactly there.
function caretOffsetAt(x: number, y: number, card: HTMLElement | null): number | null {
  const doc = document as unknown as {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    if (p) { node = p.offsetNode; offset = p.offset }
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y)
    if (r) { node = r.startContainer; offset = r.startOffset }
  }
  const body = card?.querySelector('[data-body]')
  if (!node || !body || !body.contains(node) || node.nodeType !== 3) return null
  return offset
}

// Where a handle sits on the card's edge, as left/top percentages.
const HANDLE_POS: Record<Handle, { l: string; t: string }> = {
  nw: { l: '0%', t: '0%' }, n: { l: '50%', t: '0%' }, ne: { l: '100%', t: '0%' }, e: { l: '100%', t: '50%' },
  se: { l: '100%', t: '100%' }, s: { l: '50%', t: '100%' }, sw: { l: '0%', t: '100%' }, w: { l: '0%', t: '50%' },
}

export default function BoardCanvas({
  boardId,
  brandSpaceId = '',
  cards: initialCards,
  readOnly = false,
  inner: initialInner = {},
  needsAdopt = false,
  canNest = false,
}: {
  boardId: string
  brandSpaceId?: string
  cards: Card[]
  readOnly?: boolean
  inner?: Record<string, Inner>
  needsAdopt?: boolean
  canNest?: boolean
}) {
  const router = useRouter()
  const [cards, setCards] = useState(initialCards)
  const [inner, setInner] = useState(initialInner)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const [selected, setSelectedState] = useState<Set<string>>(new Set())
  const [tool, setTool] = useState<'select' | 'hand' | 'line' | 'draw'>('select')
  const [multi, setMulti] = useState(false) // taps add to the selection (for phones, and for anyone who forgets Shift)
  const [spaceDown, setSpaceDown] = useState(false)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [cursorGrab, setCursorGrab] = useState(false)
  const [popIds, setPopIds] = useState<Set<string>>(new Set()) // cards that just appeared (they pop in)
  const [view, setView] = useState({ w: 0, h: 0 })
  const imageAt = useRef<{ x: number; y: number } | null>(null)
  const [strokes, setStrokes] = useState<{ c: string; w: number; p: [number, number][] }[]>([]) // scribbles waiting to become a drawing card
  const [liveStroke, setLiveStroke] = useState<{ c: string; w: number; p: [number, number][] } | null>(null)
  const liveRef = useRef<{ c: string; w: number; p: [number, number][] } | null>(null)
  const [penColor, setPenColor] = useState(DRAWING_INKS[0])
  const [penSize, setPenSize] = useState(3) // pen width on screen, in pixels
  const prevTool = useRef<'select' | 'hand' | 'line' | 'draw'>('select')
  const [draftLine, setDraftLine] = useState<DraftLine | null>(null)
  const [hoverCardId, setHoverCardId] = useState<string | null>(null)
  const sizesRef = useRef(new Map<string, { w: number; h: number }>())
  const [sizesVersion, setSizesVersion] = useState(0)
  const lineSave = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const audioRef = useRef<HTMLInputElement>(null)
  const moreBtn = useRef<HTMLButtonElement>(null)
  const [more, setMore] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const [anchor, setAnchor] = useState<{ cx: number; top: number; bottom: number; cw: number } | null>(null)
  // The small input box that replaces browser pop-ups, a message strip for errors, and where the bar was dragged to.
  const [dialog, setDialog] = useState<{ kind: 'link' | 'board' | 'map' | 'video' | 'rename' | 'editlink' | 'editmap'; cardId?: string; initial: string; point?: { x: number; y: number } } | null>(null)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [barPos, setBarPos] = useState<{ x: number; y: number } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const selRef = useRef(selected)
  const dragRef = useRef<Drag | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploads, setUploads] = useState<BoardUpload[]>([])
  const [dropping, setDropping] = useState(false)
  const dragDepth = useRef(0)
  const uploadsRef = useRef<BoardUpload[]>([])
  const startUploadsRef = useRef<(files: File[], at?: { x: number; y: number }) => void>(() => {})
  const uploadFiles = useRef(new Map<string, File>())
  const uploadCtl = useRef(new Map<string, AbortController>())
  const uploadedUrls = useRef(new Map<string, string>()) // so a retry after a failed "add card" does not upload again
  const caretRef = useRef<number | null>(null)

  const setSelected = (next: Set<string>) => {
    selRef.current = next
    setSelectedState(next)
  }

  // ---------- pointer handling ----------

  // Moving a column moves everything sitting on it.
  function withColumnContents(ids: string[]): string[] {
    const out = new Set(ids)
    for (const id of ids) {
      const col = cards.find((c) => c.id === id)
      if (!col || col.type !== 'column') continue
      const cw = col.width ?? WIDTH.column
      const ch = col.height ?? 360
      for (const c of cards) {
        if (c.id === id || c.type === 'column' || c.type === 'line') continue
        const cx = c.positionX + (c.width ?? WIDTH[c.type] ?? 210) / 2
        const cy = c.positionY + 40
        if (cx >= col.positionX && cx <= col.positionX + cw && cy >= col.positionY && cy <= col.positionY + ch) out.add(c.id)
      }
    }
    return Array.from(out)
  }

  function handlePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button, textarea, input, select, a, [data-nodrag]')) return
    if (e.button === 2) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = e.currentTarget as HTMLElement

    if (pointers.current.size === 2) {
      // Two fingers: pinch to zoom instead of dragging.
      const [a, b] = Array.from(pointers.current.values())
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
      dragRef.current = null
      liveRef.current = null
      setLiveStroke(null)
      setMarquee(null)
      el.setPointerCapture?.(e.pointerId)
      return
    }

    const handleEl = target.closest('[data-handle]') as HTMLElement | null
    const cardEl = target.closest('[data-card]') as HTMLElement | null
    const panWanted = readOnly || tool === 'hand' || spaceDown || e.button === 1

    if (tool === 'draw' && !readOnly && !panWanted && e.button === 0) {
      const w = worldAt(e)
      liveRef.current = { c: penColor, w: penSize / zoom, p: [[Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10]] }
      setLiveStroke(liveRef.current)
      dragRef.current = { kind: 'draw' }
      el.setPointerCapture?.(e.pointerId)
      return
    }

    const lineEnd = target.closest('[data-line-end]') as unknown as HTMLElement | null
    if (lineEnd && !readOnly && !panWanted) {
      dragRef.current = { kind: 'lineEnd', id: lineEnd.getAttribute('data-line-id') as string, end: lineEnd.getAttribute('data-line-end') as 'a' | 'b' }
      el.setPointerCapture?.(e.pointerId)
      return
    }
    if (tool === 'line' && !readOnly && !panWanted) {
      const from = cardEl?.dataset.cardId ?? null
      const w = worldAt(e)
      dragRef.current = { kind: 'newLine', from, sx: w.x, sy: w.y }
      setDraftLine({ a: from, b: null, p1: [w.x, w.y], p2: [w.x, w.y] })
      el.setPointerCapture?.(e.pointerId)
      return
    }

    if (handleEl && cardEl && !readOnly && !panWanted) {
      const id = cardEl.dataset.cardId as string
      const card = cards.find((c) => c.id === id)
      if (card) {
        const r = cardEl.getBoundingClientRect()
        const w = r.width > 0 ? r.width / zoom : card.width ?? WIDTH[card.type] ?? 210
        const h = r.height > 0 ? r.height / zoom : card.height ?? 100
        const start: Rect = { x: card.positionX, y: card.positionY, w, h }
        dragRef.current = { kind: 'resize', id, handle: handleEl.dataset.handle as Handle, start, hadHeight: card.height != null, startX: e.clientX, startY: e.clientY, last: start }
        el.setPointerCapture?.(e.pointerId)
        return
      }
    }

    if (cardEl && !readOnly && !panWanted) {
      const id = cardEl.dataset.cardId as string
      const additive = e.shiftKey || e.ctrlKey || e.metaKey || multi
      const sel = selectOnDown(selRef.current, id, additive)
      setSelected(sel.next)
      const dragIds = withColumnContents(sel.dragIds)
      const origin = new Map<string, { x: number; y: number }>()
      for (const cid of dragIds) {
        const c = cards.find((x) => x.id === cid)
        if (c) origin.set(cid, { x: c.positionX, y: c.positionY })
      }
      dragRef.current = { kind: 'cards', ids: dragIds, startX: e.clientX, startY: e.clientY, origin, dx: 0, dy: 0, moved: false, clickedId: id, additive, onUp: sel.onUp }
      el.setPointerCapture?.(e.pointerId)
      return
    }

    // Empty space (or a card when only looking). Panning for the hand tool, Space, the middle button and touch;
    // otherwise a drag draws a box that selects whatever it touches.
    if (panWanted || e.pointerType === 'touch') {
      dragRef.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY }
      setCursorGrab(true)
    } else {
      const rect = containerRef.current?.getBoundingClientRect()
      const additive = e.shiftKey || e.ctrlKey || e.metaKey || multi
      dragRef.current = { kind: 'marquee', sx: e.clientX - (rect?.left ?? 0), sy: e.clientY - (rect?.top ?? 0), additive, base: additive ? new Set(selRef.current) : new Set(), moved: false }
    }
    el.setPointerCapture?.(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchDist.current) {
      const [a, b] = Array.from(pointers.current.values())
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d > 0) {
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist.current)
        pinchDist.current = d
      }
      return
    }
    const drag = dragRef.current
    if (!drag) return

    if (drag.kind === 'draw') {
      const s = liveRef.current
      if (!s) return
      const w = worldAt(e)
      const last = s.p[s.p.length - 1]
      if (Math.hypot(w.x - last[0], w.y - last[1]) < 1.5 / zoom || s.p.length > 2500) return
      liveRef.current = { ...s, p: [...s.p, [Math.round(w.x * 10) / 10, Math.round(w.y * 10) / 10]] }
      setLiveStroke(liveRef.current)
      return
    }

    if (drag.kind === 'newLine') {
      const w = worldAt(e)
      const over = cardUnder(e.clientX, e.clientY)
      setHoverCardId(over)
      setDraftLine((d) => (d ? { ...d, p2: [w.x, w.y], b: over && over !== d.a ? over : null } : d))
      return
    }

    if (drag.kind === 'lineEnd') {
      const w = worldAt(e)
      setHoverCardId(cardUnder(e.clientX, e.clientY))
      updateLine(drag.id, (d) => (drag.end === 'a' ? { ...d, a: null, p1: [w.x, w.y] } : { ...d, b: null, p2: [w.x, w.y] }), false)
      return
    }

    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.lastX
      const dy = e.clientY - drag.lastY
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      return
    }

    if (drag.kind === 'cards') {
      const sx = e.clientX - drag.startX
      const sy = e.clientY - drag.startY
      if (!drag.moved && !movedEnough(sx, sy)) return
      drag.moved = true
      drag.dx = sx / zoom
      drag.dy = sy / zoom
      const { origin, dx, dy } = drag
      setCards((prev) => prev.map((c) => (origin.has(c.id) ? { ...c, positionX: (origin.get(c.id) as { x: number }).x + dx, positionY: (origin.get(c.id) as { y: number }).y + dy } : c)))
      return
    }

    if (drag.kind === 'resize') {
      const card = cards.find((c) => c.id === drag.id)
      if (!card) return
      const min = MIN_SIZE[card.type] ?? { w: 60, h: 40 }
      const r = resizeRect(drag.start, drag.handle, (e.clientX - drag.startX) / zoom, (e.clientY - drag.startY) / zoom, min, MAX_CARD_SIZE, WIDTH_ONLY.has(card.type))
      drag.last = r
      const vertical = drag.handle.includes('n') || drag.handle.includes('s')
      const setHeight = !WIDTH_ONLY.has(card.type) && (vertical || drag.hadHeight)
      setCards((prev) => prev.map((c) => (c.id === drag.id ? { ...c, positionX: r.x, positionY: r.y, width: r.w, height: setHeight ? r.h : null } : c)))
      return
    }

    if (drag.kind === 'marquee') {
      const rect = containerRef.current?.getBoundingClientRect()
      const cx = e.clientX - (rect?.left ?? 0)
      const cy = e.clientY - (rect?.top ?? 0)
      if (!drag.moved && !movedEnough(cx - drag.sx, cy - drag.sy)) return
      drag.moved = true
      const box = normalizeRect(drag.sx, drag.sy, cx, cy)
      setMarquee(box)
      // Compare on screen, using the real size of each card as drawn (their heights follow their content).
      const hits = new Set(drag.base)
      const left = (rect?.left ?? 0) + box.x
      const top = (rect?.top ?? 0) + box.y
      containerRef.current?.querySelectorAll<HTMLElement>('[data-card]').forEach((node) => {
        const r = node.getBoundingClientRect()
        if (r.left < left + box.w && r.right > left && r.top < top + box.h && r.bottom > top) hits.add(node.dataset.cardId as string)
      })
      setSelected(hits)
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchDist.current = null
    if (pointers.current.size === 1 && !dragRef.current) {
      // One finger left after a pinch: carry on as a pan, without a jump.
      const [p] = Array.from(pointers.current.values())
      dragRef.current = { kind: 'pan', lastX: p.x, lastY: p.y }
      return
    }
    const drag = dragRef.current
    dragRef.current = null
    setCursorGrab(false)
    if (!drag) return

    if (drag.kind === 'cards') {
      if (drag.moved) {
        const moves = drag.ids.flatMap((id) => {
          const o = drag.origin.get(id)
          return o ? [{ id, x: o.x + drag.dx, y: o.y + drag.dy }] : []
        })
        moveBoardCards(boardId, moves).catch(() => {})
        refreshLines(new Set(drag.ids))
      } else {
        if (drag.onUp === 'collapse') setSelected(new Set([drag.clickedId]))
        else if (drag.onUp === 'remove') {
          const next = new Set(selRef.current)
          next.delete(drag.clickedId)
          setSelected(next)
        }
        // A plain click (not a drag, not an add-to-selection click) on a note or a title: just start typing.
        const clicked = cardsRef.current.find((c) => c.id === drag.clickedId)
        // A plain click on a document opens its page, like opening a page in Notion. (Shift-click still just selects it.)
        if (!drag.additive && clicked && clicked.type === 'document') setTimeout(() => setEditingId(clicked.id), 80)
        if (!drag.additive && clicked && (clicked.type === 'note' || clicked.type === 'heading' || clicked.type === 'comment')) {
          caretRef.current = caretOffsetAt(e.clientX, e.clientY, containerRef.current?.querySelector<HTMLElement>(`[data-card-id="${clicked.id}"]`) ?? null)
          setEditingId(clicked.id)
        }
      }
    } else if (drag.kind === 'resize') {
      const card = cards.find((c) => c.id === drag.id)
      const r = drag.last
      const vertical = drag.handle.includes('n') || drag.handle.includes('s')
      const keepHeight = card && !WIDTH_ONLY.has(card.type) && (vertical || drag.hadHeight)
      if (card) resizeBoardCard(boardId, drag.id, { x: r.x, y: r.y, w: r.w, h: keepHeight ? r.h : null }).catch(() => {})
      setTimeout(() => refreshLines(new Set([drag.id])), 120)
    } else if (drag.kind === 'draw') {
      const s = liveRef.current
      liveRef.current = null
      setLiveStroke(null)
      if (s) setStrokes((prev) => [...prev, s])
    } else if (drag.kind === 'newLine') {
      finishNewLine(drag, e)
      setDraftLine(null)
      setHoverCardId(null)
    } else if (drag.kind === 'lineEnd') {
      const over = cardUnder(e.clientX, e.clientY)
      const w = worldAt(e)
      updateLine(drag.id, (d) => {
        const otherEnd = drag.end === 'a' ? d.b : d.a
        const attach = over && over !== otherEnd ? over : null
        const next: LineData = drag.end === 'a' ? { ...d, a: attach, p1: [w.x, w.y] } : { ...d, b: attach, p2: [w.x, w.y] }
        const r = resolveLine(next, boxOf)
        return { ...next, p1: [r.p1.x, r.p1.y], p2: [r.p2.x, r.p2.y] }
      })
      setHoverCardId(null)
    } else if (drag.kind === 'marquee') {
      setMarquee(null)
      if (!drag.moved && !drag.additive) setSelected(new Set()) // a plain click on empty space clears the selection
    }
  }

  // ---------- zoom ----------

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = clientX - rect.left
    const cy = clientY - rect.top
    const worldX = (cx - pan.x) / zoom
    const worldY = (cy - pan.y) / zoom
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    setPan({ x: cx - worldX * newZoom, y: cy - worldY * newZoom })
    setZoom(newZoom)
  }

  // A native listener is needed so zooming doesn't also scroll the page.
  const wheelRef = useRef<(e: WheelEvent) => void | undefined>(undefined)
  wheelRef.current = (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + scroll, and a pinch on a trackpad (which arrives as Ctrl + scroll)
      const d = Math.max(-30, Math.min(30, e.deltaY))
      zoomAt(e.clientX, e.clientY, Math.exp(-d * 0.006))
      return
    }
    const unit = e.deltaMode === 1 ? 16 : 1
    const sideways = e.shiftKey && e.deltaX === 0
    const dx = (sideways ? e.deltaY : e.deltaX) * unit
    const dy = (sideways ? 0 : e.deltaY) * unit
    setPan((p) => ({ x: p.x - dx, y: p.y - dy }))
  }
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelRef.current?.(e)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setView((v) => (v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The area the scrollbars cover: everything on the board.
  const bounds = useMemo(() => {
    if (cards.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const c of cards) {
      if (c.type === 'line') continue
      minX = Math.min(minX, c.positionX)
      minY = Math.min(minY, c.positionY)
      maxX = Math.max(maxX, c.positionX + (c.width ?? WIDTH[c.type] ?? 210))
      maxY = Math.max(maxY, c.positionY + (c.height ?? 160))
    }
    return { minX, minY, maxX, maxY }
  }, [cards])

  function zoomButton(factor: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  // ---------- keyboard ----------

  const deleteRef = useRef<() => void | undefined>(undefined)
  deleteRef.current = deleteSelected
  useEffect(() => {
    const typingIn = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const onDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (typingIn(e.target)) return
      if (document.querySelector('[data-page-overlay]')) return // a page is open: its keys are its own
      if (e.code === 'Space' && !(el && (el.tagName === 'BUTTON' || el.tagName === 'A'))) {
        e.preventDefault()
        setSpaceDown(true)
        return
      }
      if (readOnly) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current.size > 0) {
        e.preventDefault()
        deleteRef.current?.()
      } else if (e.key === 'Escape') {
        setSelected(new Set())
        setTool((t) => (t === 'line' ? 'select' : t))
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelected(new Set(cardsRef.current.map((c) => c.id)))
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    const onBlur = () => setSpaceDown(false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  // ---------- lines and arrows ----------
  const lineItems = useMemo<LineItem[]>(() => cards.flatMap((c) => {
    if (c.type !== 'line') return []
    const d = parseLine(c.content)
    return d ? [{ id: c.id, data: d }] : []
  }), [cards])

  // Where each card is, as drawn (heights follow the content, so they are measured from the screen).
  function boxOf(id: string): Box | undefined {
    const c = cardsRef.current.find((x) => x.id === id && x.type !== 'line')
    if (!c) return undefined
    const sz = sizesRef.current.get(id)
    return { x: c.positionX, y: c.positionY, w: sz?.w ?? c.width ?? WIDTH[c.type] ?? 210, h: sz?.h ?? c.height ?? 120 }
  }

  const cardKey = cards.map((c) => c.id).join(',')
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      let changed = false
      for (const en of entries) {
        const t = en.target as HTMLElement
        const id = t.dataset.cardId
        if (!id) continue
        const w = t.offsetWidth
        const h = t.offsetHeight
        const old = sizesRef.current.get(id)
        if (!old || Math.abs(old.w - w) > 0.5 || Math.abs(old.h - h) > 0.5) {
          sizesRef.current.set(id, { w, h })
          changed = true
        }
      }
      if (changed) setSizesVersion((v) => v + 1)
    })
    el.querySelectorAll<HTMLElement>('[data-card]').forEach((n) => ro.observe(n))
    return () => ro.disconnect()
  }, [cardKey])

  function updateLine(id: string, change: (d: LineData) => LineData, persist = true) {
    const card = cardsRef.current.find((c) => c.id === id)
    const d = card ? parseLine(card.content) : null
    if (!card || !d) return
    const content = serializeLine(change(d))
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)))
    if (persist && !readOnly) {
      clearTimeout(lineSave.current.get(id))
      lineSave.current.set(id, setTimeout(() => { updateBoardCard(id, content).catch(() => {}) }, 350))
    }
  }

  // After cards move or resize, remember where each attached line end now is, so a copy of the board can re-attach them.
  function refreshLines(ids: Set<string>) {
    const updates: { id: string; content: string }[] = []
    for (const c of cardsRef.current) {
      if (c.type !== 'line') continue
      const d = parseLine(c.content)
      if (!d || !((d.a && ids.has(d.a)) || (d.b && ids.has(d.b)))) continue
      const r = resolveLine(d, boxOf)
      updates.push({ id: c.id, content: serializeLine({ ...d, p1: [r.p1.x, r.p1.y], p2: [r.p2.x, r.p2.y] }) })
    }
    if (updates.length === 0) return
    const byId = new Map(updates.map((u) => [u.id, u.content]))
    setCards((prev) => prev.map((c) => (byId.has(c.id) ? { ...c, content: byId.get(c.id) as string } : c)))
    for (const u of updates) updateBoardCard(u.id, u.content).catch(() => {})
  }

  // In a copy of a board the cards have new ids. Hook each line end back onto the card it was touching.
  useEffect(() => {
    if (sizesVersion === 0) return
    const known = new Set(cards.filter((c) => c.type !== 'line').map((c) => c.id))
    const boxes = Array.from(known).flatMap((id) => {
      const box = boxOf(id)
      return box ? [{ id, box }] : []
    })
    for (const c of cards) {
      if (c.type !== 'line') continue
      const d = parseLine(c.content)
      if (!d || !((d.a && !known.has(d.a)) || (d.b && !known.has(d.b)))) continue
      const next = serializeLine(healLine(d, boxes, known))
      if (next === c.content) continue
      setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, content: next } : x)))
      if (!readOnly) updateBoardCard(c.id, next).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizesVersion, cards.length])

  // Leaving draw mode turns the scribbles into one drawing card, sized to fit and placed where you drew.
  async function commitDrawing() {
    const all = strokes
    setStrokes([])
    if (all.length === 0) return
    const built = fitDrawing(all)
    if (!built) return void notify('That drawing is too detailed to save. Try drawing in smaller pieces.')
    const made = await addCard('drawing', built.content, true, { x: built.x, y: built.y })
    if (made.ok && made.id) {
      const id = made.id
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, width: built.w } : c)))
      resizeBoardCard(boardId, id, { x: built.x, y: built.y, w: built.w, h: null }).catch(() => {})
    }
  }

  useEffect(() => {
    if (prevTool.current === 'draw' && tool !== 'draw') void commitDrawing()
    prevTool.current = tool
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  const worldAt = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect()
    return { x: (e.clientX - (rect?.left ?? 0) - pan.x) / zoom, y: (e.clientY - (rect?.top ?? 0) - pan.y) / zoom }
  }

  // The card under the pointer, if any (looks through the line layer and the toolbar).
  function cardUnder(clientX: number, clientY: number): string | null {
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      const holder = (el as Element).closest?.('[data-card]') as HTMLElement | null
      if (holder?.dataset.cardId) return holder.dataset.cardId
    }
    return null
  }

  function selectLine(id: string, additive: boolean) {
    if (readOnly) return
    const next = additive ? new Set(selRef.current) : new Set<string>()
    if (additive && next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
    setEditingId(null)
  }

  function finishNewLine(drag: Extract<Drag, { kind: 'newLine' }>, e: React.PointerEvent) {
    const to = cardUnder(e.clientX, e.clientY)
    const end = worldAt(e)
    const dist = Math.hypot(end.x - drag.sx, end.y - drag.sy)
    const from = drag.from
    if (dist < 14 || (from && to && from === to)) return // that was a click, not a line
    const base: LineData = { a: from, b: to && to !== from ? to : null, p1: [drag.sx, drag.sy], p2: [end.x, end.y], head: 'end', dash: false, c: null, w: 2 }
    const r = resolveLine(base, boxOf)
    void addCard('line', serializeLine({ ...base, p1: [r.p1.x, r.p1.y], p2: [r.p2.x, r.p2.y] }), true, { x: 0, y: 0 })
    setTool('select')
  }

  // The floating formatting bar follows whatever is selected.
  useLayoutEffect(() => {
    const el = containerRef.current
    const box = el?.getBoundingClientRect()
    if (!el || !box || readOnly || selected.size === 0) {
      setAnchor((a) => (a ? null : a))
      return
    }
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
    el.querySelectorAll<HTMLElement>('[data-card]').forEach((node) => {
      if (!selected.has(node.dataset.cardId as string)) return
      const rc = node.getBoundingClientRect()
      l = Math.min(l, rc.left); t = Math.min(t, rc.top); r = Math.max(r, rc.right); b = Math.max(b, rc.bottom)
    })
    if (!Number.isFinite(l)) {
      setAnchor((a) => (a ? null : a))
      return
    }
    const next = { cx: Math.round((l + r) / 2 - box.left), top: Math.round(t - box.top), bottom: Math.round(b - box.top), cw: Math.round(box.width) }
    setAnchor((a) => (a && a.cx === next.cx && a.top === next.top && a.bottom === next.bottom && a.cw === next.cw ? a : next))
  }, [selected, cards, pan, zoom, editingId, readOnly, popIds])

  useEffect(() => {
    if (!editingId) return
    const c = cardsRef.current.find((x) => x.id === editingId)
    if (c && (c.type === 'sketch' || c.type === 'drawing') && !selected.has(editingId)) setEditingId(null)
  }, [selected, editingId])

  const growBox = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`
  }
  const editRef = (fixedHeight: boolean) => (el: HTMLTextAreaElement | null) => {
    if (!el || el.dataset.ready) return
    el.dataset.ready = '1'
    const pos = caretRef.current ?? el.value.length
    caretRef.current = null
    el.focus()
    try { el.setSelectionRange(pos, pos) } catch {}
    if (!fixedHeight) growBox(el)
  }
  const editKeys = (commitOnEnter: boolean) => (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' || (commitOnEnter && e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  // ---------- one-time fixes for older boards ----------

  // Link cards made before previews existed get their thumbnail the first time an editor opens the board.
  useEffect(() => {
    if (readOnly) return
    const missing = initialCards.filter((c) => c.type === 'link' && c.meta == null).slice(0, 12)
    if (missing.length === 0) return
    let cancelled = false
    ;(async () => {
      for (const c of missing) {
        try {
          const meta = await refreshLinkPreview(c.id)
          if (cancelled) return
          setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, meta } : x)))
        } catch {}
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Boards made inside this one before tiles existed get their tile the first time an editor opens it.
  useEffect(() => {
    if (!needsAdopt || readOnly) return
    adoptInnerBoards(boardId)
      .then((made) => {
        if (made.length === 0) return
        setCards((prev) => [...prev, ...made.map(({ inner: _i, ...c }) => c)])
        setInner((prev) => ({ ...prev, ...Object.fromEntries(made.map((m) => [m.inner.id, m.inner])) }))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- adding, editing, styling, deleting ----------

  // A message on the board (instead of a browser alert box). It fades after a few seconds.
  function notify(text: string, kind: 'error' | 'info' = 'error') {
    setNotice({ kind, text })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 7000)
  }

  // New cards appear in the middle of what you are looking at.
  async function addCard(type: string, content: string, quiet = false, at?: { x: number; y: number }): Promise<{ ok: boolean; message?: string; id?: string }> {
    const rect = containerRef.current?.getBoundingClientRect()
    const w = WIDTH[type] ?? 210
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 150
    const x = at ? at.x : cx - w / 2 + (Math.random() - 0.5) * 60
    const y = at ? at.y : cy - 50 + (Math.random() - 0.5) * 60
    try {
      const { inner: innerInfo, ...created } = await addBoardCardAt(boardId, type, content, x, y)
      setCards((prev) => [...prev, created])
      setPopIds((prev) => new Set(prev).add(created.id))
      setTimeout(() => setPopIds((prev) => { const n = new Set(prev); n.delete(created.id); return n }), 600)
      setSelected(new Set([created.id]))
      if (innerInfo) setInner((prev) => ({ ...prev, [innerInfo.id]: innerInfo }))
      if (type === 'note' || type === 'heading' || type === 'comment' || type === 'sketch' || type === 'document') setEditingId(created.id)
      return { ok: true, id: created.id }
    } catch (err) {
      const message = err instanceof Error && /levels deep|name|link/.test(err.message) ? err.message : 'Could not add that card. Please try again.'
      if (!quiet) notify(message)
      return { ok: false, message }
    }
  }

  // Every tool in the sidebar, whether it was clicked (lands in the middle of your view) or dragged
  // onto the board (lands where you let go).
  async function runTool(key: string, point?: { x: number; y: number }) {
    if (key !== 'line' && key !== 'draw') setTool((t) => (t === 'line' || t === 'draw' ? 'select' : t))
    if (key === 'draw') {
      setSelected(new Set())
      setTool((t) => (t === 'draw' ? 'select' : 'draw'))
      return
    }
    if (key === 'line') {
      if (!point) {
        setSelected(new Set())
        setTool((t) => (t === 'line' ? 'select' : 'line'))
        return
      }
      // Dropped from the sidebar: a ready-made arrow you can then drag onto cards.
      const data: LineData = { a: null, b: null, p1: [point.x - 90, point.y], p2: [point.x + 90, point.y], head: 'end', dash: false, c: null, w: 2 }
      return void addCard('line', serializeLine(data), true, { x: 0, y: 0 })
    }
    const at = (type: string) => (point ? { x: point.x - (WIDTH[type] ?? 210) / 2, y: point.y - 30 } : undefined)
    if (key === 'note') return void addCard('note', '', false, at('note'))
    if (key === 'title') return void addCard('heading', '', false, at('heading'))
    if (key === 'todo') return void addCard('todo', '', false, at('todo'))
    if (key === 'color') return void addCard('color', COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)], false, at('color'))
    if (key === 'image') {
      imageAt.current = point ?? null
      fileRef.current?.click()
      return
    }
    if (key === 'link') return void setDialog({ kind: 'link', initial: '', point })
    if (key === 'board') return void setDialog({ kind: 'board', initial: '', point })
    if (key === 'sketch') return void addCard('sketch', '', false, at('sketch'))
    if (key === 'document') return void addCard('document', '', false, at('document'))
    if (key === 'table') return void addCard('table', DEFAULT_TABLE, false, at('table'))
    if (key === 'column') return void addCard('column', '', false, at('column'))
    if (key === 'comment') return void addCard('comment', '', false, at('comment'))
    if (key === 'audio') {
      imageAt.current = point ?? null
      audioRef.current?.click()
      return
    }
    if (key === 'map') return void setDialog({ kind: 'map', initial: '', point })
    if (key === 'video') return void setDialog({ kind: 'video', initial: '', point })
  }

  // What the little box does with what you typed.
  async function submitDialog(value: string) {
    const d = dialog
    setDialog(null)
    if (!d) return
    const card = d.cardId ? cardsRef.current.find((c) => c.id === d.cardId) : undefined
    const at = (type: string) => (d.point ? { x: d.point.x - (WIDTH[type] ?? 210) / 2, y: d.point.y - 30 } : undefined)
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`
    if (d.kind === 'link') {
      setBusy(true)
      try {
        await addCard('link', url, false, at('link'))
      } finally {
        setBusy(false)
      }
    } else if (d.kind === 'board') {
      await addCard('board', value, false, at('board'))
    } else if (d.kind === 'map') {
      await addCard('map', value, false, at('map'))
    } else if (d.kind === 'video') {
      // Links we cannot play here (TikTok, Instagram…) still make a good card: a picture that opens the video.
      const type = videoSource(url) ? 'video' : 'link'
      await addCard(type, url, false, at(type))
    } else if (d.kind === 'editlink') {
      if (card) commitEdit(card, url)
    } else if (d.kind === 'editmap') {
      if (card) saveContent(card.id, value)
    } else if (d.kind === 'rename' && card) {
      if (value === (inner[card.content]?.name ?? '')) return
      setInner((prev) => ({ ...prev, [card.content]: { ...(prev[card.content] as Inner), name: value } }))
      renameBoardTile(card.id, value).catch(() => notify('Could not rename that board. Please try again.'))
    }
  }

  function patchUpload(id: string, patch: Partial<UploadView>) {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  function dropUpload(id: string) {
    uploadFiles.current.delete(id)
    uploadCtl.current.delete(id)
    uploadedUrls.current.delete(id)
    setUploads((prev) => {
      const gone = prev.find((u) => u.id === id)
      if (gone) URL.revokeObjectURL(gone.preview)
      return prev.filter((u) => u.id !== id)
    })
  }

  // Wait (briefly) for the real picture to load, so swapping the placeholder for the card does not flash.
  const preload = (url: string) =>
    new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = img.onerror = () => resolve()
      img.src = url
      setTimeout(resolve, 3000)
    })

  async function runUpload(id: string) {
    const file = uploadFiles.current.get(id)
    const spot = uploadsRef.current.find((u) => u.id === id)
    if (!file || !spot) return // cancelled while waiting in line
    const controller = new AbortController()
    uploadCtl.current.set(id, controller)
    try {
      let url = uploadedUrls.current.get(id)
      if (!url) {
        patchUpload(id, { status: isImageFile(file) ? 'preparing' : 'uploading', percent: 0, error: undefined })
        const res = await uploadFile(file, {
          signal: controller.signal,
          onProgress: (percent, phase) => patchUpload(id, { percent, status: phase }),
        })
        url = res.url
        uploadedUrls.current.set(id, url)
      }
      patchUpload(id, { status: 'saving', percent: 100, error: undefined })
      const kind = file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'image'
      if (kind === 'image') await preload(url)
      const saved = await addCard(kind, kind === 'image' ? url : `${url}\n${file.name}`, true, { x: spot.x, y: spot.y })
      if (!saved.ok) {
        patchUpload(id, { status: 'error', error: `Uploaded, but could not add it to the board. ${saved.message ?? ''}`.trim() })
        return
      }
      dropUpload(id) // the real card is already in the same spot
    } catch (err) {
      if (controller.signal.aborted) return dropUpload(id)
      patchUpload(id, { status: 'error', error: friendlyUploadError(err).message })
    }
  }

  // Images dropped, pasted or picked land right where you are looking (or where you dropped them),
  // show up immediately as a faded preview, and fill in as they upload.
  function startUploads(rawFiles: File[], drop?: { x: number; y: number }) {
    const files = rawFiles.filter((f) => isImageFile(f) || /^(audio|video)\//.test(f.type)).slice(0, 12)
    if (!files.length) return
    const w = WIDTH.image
    const rect = containerRef.current?.getBoundingClientRect()
    const base = drop
      ? { x: drop.x - w / 2, y: drop.y - 60 }
      : { x: (rect ? (rect.width / 2 - pan.x) / zoom : 200) - w / 2, y: (rect ? (rect.height / 2 - pan.y) / zoom : 150) - 80 }
    const cols = Math.min(files.length, 3)
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const fresh: BoardUpload[] = files.map((file, i) => {
      const id = `${stamp}-${i}`
      uploadFiles.current.set(id, file)
      return {
        id,
        name: file.name,
        percent: 0,
        status: 'queued',
        preview: URL.createObjectURL(file),
        x: base.x + (i % cols) * (w + 16),
        y: base.y + Math.floor(i / cols) * (w * 0.85 + 16),
      }
    })
    uploadsRef.current = [...uploadsRef.current, ...fresh]
    setUploads((prev) => [...prev, ...fresh])
    // A few at a time: fast on good connections, and does not choke a phone on a big batch.
    let next = 0
    const worker = async () => {
      while (next < fresh.length) await runUpload(fresh[next++].id)
    }
    void Promise.all(Array.from({ length: Math.min(3, fresh.length) }, worker))
  }
  startUploadsRef.current = startUploads
  useEffect(() => {
    uploadsRef.current = uploads
  }, [uploads])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const where = imageAt.current ?? undefined
    imageAt.current = null
    startUploads(files, where)
  }

  // Paste a copied image or screenshot (Ctrl/Cmd+V) anywhere on the page, unless you are typing in a field.
  useEffect(() => {
    if (readOnly) return
    function onPaste(e: ClipboardEvent) {
      if (document.querySelector('[data-page-overlay]')) return // a page is open: pasting belongs to the page
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      const files = Array.from(e.clipboardData?.files ?? []).filter(isImageFile)
      if (!files.length) return
      e.preventDefault()
      startUploadsRef.current(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [readOnly])

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
  const hasTool = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('application/x-brandos-tool')
  function onDragEnter(e: React.DragEvent) {
    if (readOnly || !hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDropping(true)
  }
  function onDragOver(e: React.DragEvent) {
    if (readOnly || !(hasFiles(e) || hasTool(e))) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  function onDragLeave(e: React.DragEvent) {
    if (readOnly || !hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDropping(false)
  }
  function onDrop(e: React.DragEvent) {
    if (readOnly) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const point = { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom }
    if (hasTool(e)) {
      e.preventDefault()
      void runTool(e.dataTransfer.getData('application/x-brandos-tool'), point)
      return
    }
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDropping(false)
    startUploads(Array.from(e.dataTransfer.files), point)
  }

  // Checklists and color cards save as you type; the card keeps its own state.
  function saveContent(id: string, text: string) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, content: text } : c)))
    updateBoardCard(id, text).catch(() => {})
  }

  function commitEdit(card: Card, value: string) {
    setEditingId(null)
    const text = value.trim()
    if (!text) {
      setCards((prev) => prev.filter((c) => c.id !== card.id))
      setSelected(new Set())
      deleteBoardCard(card.id).catch(() => {})
      return
    }
    if (text === card.content) return
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, content: text, ...(card.type === 'link' ? { meta: null } : {}) } : c)))
    setBrokenImages((prev) => {
      const next = new Set(prev)
      next.delete(card.id)
      return next
    })
    updateBoardCard(card.id, text)
      .then((saved) => setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, content: saved.content, meta: saved.meta } : c))))
      .catch(() => notify('Could not save that change. Please try again.'))
  }

  // Changes how every selected card looks. The screen updates at once; the save follows.
  function applyStyle(patch: Record<string, unknown>) {
    const ids = Array.from(selRef.current)
    if (ids.length === 0) return
    const idSet = new Set(ids)
    setCards((prev) => prev.map((c) => (idSet.has(c.id) ? { ...c, style: styleToJson(mergeStyle(parseStyle(c.style), patch)) } : c)))
    styleBoardCards(boardId, ids, patch).catch(() => notify('Could not save that change. Please try again.'))
  }

  function deleteSelected() {
    const ids = Array.from(selRef.current)
    if (ids.length === 0 || readOnly) return
    const tiles = cardsRef.current.filter((c) => idsHas(ids, c.id) && c.type === 'board').length
    const message = tiles > 0 ? `Delete ${ids.length === 1 ? 'this board' : `these ${ids.length} cards, including ${tiles} ${tiles === 1 ? 'board' : 'boards'}`} and everything inside?` : ids.length > 1 ? `Delete these ${ids.length} cards?` : ''
    if (message && !confirm(message)) return
    const gone = new Set(ids)
    for (const c of cardsRef.current) {
      if (c.type !== 'line' || gone.has(c.id)) continue
      const d = parseLine(c.content)
      if (d && ((d.a && gone.has(d.a)) || (d.b && gone.has(d.b)))) {
        gone.add(c.id)
        ids.push(c.id)
      }
    }
    setCards((prev) => prev.filter((c) => !gone.has(c.id)))
    setSelected(new Set())
    deleteBoardCards(boardId, ids).catch(() => notify('Could not delete. Please refresh and try again.'))
  }
  const idsHas = (ids: string[], id: string) => ids.includes(id)

  function openBoard(card: Card) {
    if (brandSpaceId) router.push(`/brand-spaces/${brandSpaceId}/boards/${card.content}`)
  }

  function renameTile(card: Card) {
    setDialog({ kind: 'rename', cardId: card.id, initial: inner[card.content]?.name ?? '' })
  }

  function startEdit(card: Card) {
    if (card.type === 'board') return openBoard(card)
    if (card.type === 'document') return setEditingId(card.id) // people with view-only access can read documents too
    if (readOnly) return
    if (card.type === 'note' || card.type === 'heading' || card.type === 'comment' || card.type === 'sketch' || card.type === 'drawing') return setEditingId(card.id)
    if (card.type === 'map') return setDialog({ kind: 'editmap', cardId: card.id, initial: card.content })
    if (card.type === 'link') setDialog({ kind: 'editlink', cardId: card.id, initial: card.content })
  }

  type Tool = { key: string; label: string; icon: React.ReactNode; hint: string }
  const mainTools: Tool[] = [
    { key: 'note', label: 'Note', icon: Icons.note, hint: 'Add a note (or drag it onto the board)' },
    { key: 'link', label: 'Link', icon: Icons.link, hint: 'Add a link: Pinterest, YouTube, any page' },
    { key: 'todo', label: 'To-do', icon: Icons.todo, hint: 'Add a to-do list (or drag it onto the board)' },
    { key: 'line', label: 'Line', icon: Icons.line, hint: 'Connect cards with a line or arrow: drag from one card to another (or drag this onto the board)' },
    ...(canNest ? [{ key: 'board', label: 'Board', icon: Icons.board, hint: 'Add a board inside this board' }] : []),
  ]
  const moreTools: Tool[] = [
    { key: 'sketch', label: 'Sketch', icon: Icons.sketch, hint: 'Draw a quick sketch' },
    { key: 'color', label: 'Color', icon: Icons.color, hint: 'Add a color swatch' },
    { key: 'document', label: 'Document', icon: Icons.document, hint: 'Write a longer page' },
    { key: 'audio', label: 'Audio', icon: Icons.audio, hint: 'Add an audio file' },
    { key: 'map', label: 'Map', icon: Icons.map, hint: 'Pin a place on a map' },
    { key: 'video', label: 'Video', icon: Icons.video, hint: 'Add a YouTube / Vimeo link or video file' },
    { key: 'title', label: 'Heading', icon: Icons.title, hint: 'Add a big title' },
    { key: 'table', label: 'Table', icon: Icons.table, hint: 'Add a table' },
    { key: 'comment', label: 'Comment', icon: Icons.comment, hint: 'Add a comment bubble' },
    { key: 'column', label: 'Column', icon: Icons.column, hint: 'Add a column to group cards' },
  ]
  const imageTool: Tool = { key: 'image', label: 'Image', icon: Icons.image, hint: 'Add images (or drop / paste them on the board)' }
  const drawTool: Tool = { key: 'draw', label: 'Draw', icon: Icons.draw, hint: 'Draw freehand on the board' }

  function startToolDrag(e: React.DragEvent, t: Tool) {
    e.dataTransfer.setData('application/x-brandos-tool', t.key)
    e.dataTransfer.setData('text/plain', t.label)
    e.dataTransfer.effectAllowed = 'copy'
    setTimeout(() => setMore(null), 0) // close the menu once the drag has started
  }

  function toggleMore() {
    if (more) return setMore(null)
    const r = moreBtn.current?.getBoundingClientRect()
    if (!r) return
    if (window.innerWidth <= 760) setMore({ left: Math.max(8, Math.min(r.left, window.innerWidth - 292)), bottom: window.innerHeight - r.top + 8 })
    else setMore({ left: r.right + 8, top: Math.max(8, Math.min(r.top - 8, window.innerHeight - 300)) })
  }

  useEffect(() => {
    if (!more) return
    const close = (e: Event) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('.rail-more') || t?.closest('[data-more-button]')) return
      setMore(null)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMore(null)
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', key)
    }
  }, [more])

  const railButton = (t: Tool) => (
    <div key={t.key} draggable={t.key !== 'draw'} onDragStart={(e) => startToolDrag(e, t)}>
      <button type="button" className={`rail-btn${(t.key === 'line' || t.key === 'draw') && tool === t.key ? ' active' : ''}`} aria-pressed={t.key === 'line' || t.key === 'draw' ? tool === t.key : undefined} onClick={() => runTool(t.key)} disabled={busy} title={t.hint}>
        <span className="rail-icon">{t.icon}</span>
        <span className="rail-label">{t.label}</span>
      </button>
    </div>
  )

  // ---------- drawing ----------

  const selectedCards = cards.filter((c) => selected.has(c.id))
  const selectedLine = selected.size === 1 ? lineItems.find((l) => selected.has(l.id)) ?? null : null
  const single = selectedCards.length === 1 ? selectedCards[0] : null
  const panning = tool === 'hand' || spaceDown
  const hs = 11 / zoom // handle size, kept the same on screen at any zoom

  const toolBtn = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    fontSize: 12,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
    background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
    color: active ? 'var(--accent-text)' : 'var(--text-primary)',
  })

  return (
    <div className="board-root" style={{ position: 'relative' }}>
      {dialog && (
        <BoardPrompt
          key={`${dialog.kind}-${dialog.cardId ?? ''}`}
          title={{ link: 'Paste a link', board: 'Name this board', map: 'Search a place or address', video: 'Paste a video link', rename: 'Rename this board', editlink: 'Edit link', editmap: 'Search a place or address' }[dialog.kind]}
          placeholder={{ link: 'https://…', board: 'For example: Inspirations', map: 'Like Windhoek, Namibia', video: 'YouTube, Vimeo, or a video file link', rename: 'Board name', editlink: 'https://…', editmap: 'Like Windhoek, Namibia' }[dialog.kind]}
          initial={dialog.initial}
          submitLabel={{ link: 'Add', board: 'Create', map: 'Add', video: 'Add', rename: 'Save', editlink: 'Save', editmap: 'Save' }[dialog.kind]}
          onSubmit={submitDialog}
          onCancel={() => setDialog(null)}
        />
      )}

      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 20, width: 340, maxWidth: 'calc(100% - 200px)', background: 'var(--bg-card)', border: `1px solid ${notice.kind === 'error' ? 'var(--accent-border)' : 'var(--border-strong)'}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12.5, color: notice.kind === 'error' ? 'var(--accent-text)' : 'var(--text-primary)', overflowWrap: 'anywhere' }}>{notice.text}</div>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" style={{ fontSize: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
        </div>
      )}

      <div className={`board-layout${readOnly ? '' : ' has-rail'}`}>
        {!readOnly && (
          <div className="board-rail" role="toolbar" aria-label="Add to the board">
            {mainTools.map(railButton)}
            <button ref={moreBtn} type="button" data-more-button className="rail-btn" onClick={toggleMore} aria-haspopup="menu" aria-expanded={!!more} title="More cards: sketch, color, document, audio, map, video, table…">
              <span className="rail-icon">{Icons.more}</span>
              <span className="rail-label">More</span>
            </button>
            <div className="rail-sep" />
            {railButton(imageTool)}
            {railButton(drawTool)}
            <input ref={audioRef} type="file" accept="audio/*" multiple onChange={handleFile} style={{ display: 'none' }} />
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} style={{ display: 'none' }} />
            {more && (
              <div className="rail-more" role="menu" style={{ left: more.left, top: more.top, bottom: more.bottom }}>
                {moreTools.map((t) => (
                  <div key={t.key} draggable onDragStart={(e) => startToolDrag(e, t)}>
                    <button type="button" role="menuitem" className="rail-btn" title={t.hint} onClick={() => { setMore(null); void runTool(t.key) }}>
                      <span className="rail-icon">{t.icon}</span>
                      <span className="rail-label">{t.label}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rail-spacer" />
            <button type="button" className="rail-btn" onClick={deleteSelected} disabled={selected.size === 0} title="Delete the selected cards (or press Delete)">
              <span className="rail-icon">{Icons.trash}</span>
              <span className="rail-label">Trash</span>
            </button>
          </div>
        )}
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!readOnly && (
          <>
            <button type="button" aria-pressed={tool === 'select'} onClick={() => setTool('select')} title="Select: drag on empty space to select several cards" style={toolBtn(tool === 'select' && !spaceDown)}>↖ Select</button>
            <button type="button" aria-pressed={tool === 'hand'} onClick={() => setTool('hand')} title="Hand: drag to move around the board (or hold Space)" style={toolBtn(panning)}>✋ Move</button>
            <button type="button" aria-pressed={multi} onClick={() => setMulti((m) => !m)} title="When on, tapping a card adds it to the selection" style={toolBtn(multi)}>Multi</button>
          </>
        )}
        <button type="button" onClick={() => zoomButton(1 / 1.2)} style={{ padding: '4px 10px' }}>−</button>
        <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} style={{ padding: '4px 10px', fontSize: 11 }}>{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => zoomButton(1.2)} style={{ padding: '4px 10px' }}>+</button>
      </div>

      <div
        ref={containerRef}
        className="canvas-box"
        data-testid="canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{ position: 'relative', width: '100%', border: '1px solid var(--border)', overflow: 'hidden', backgroundColor: 'var(--bg-app)', backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px)', backgroundSize: `${22 * zoom}px ${22 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px`, cursor: (tool === 'line' || tool === 'draw') && !readOnly ? 'crosshair' : readOnly || panning || cursorGrab ? (cursorGrab ? 'grabbing' : 'grab') : marquee ? 'crosshair' : 'default', touchAction: 'none', userSelect: 'none' }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
          {[...cards].filter((c) => c.type !== 'line').sort((a, b) => Number(b.type === 'column') - Number(a.type === 'column')).map((card) => {
            const editing = editingId === card.id
            const isSel = selected.has(card.id)
            const st: CardStyle = parseStyle(card.style)
            const isHeading = card.type === 'heading'
            const fs = st.fs ?? DEFAULT_FS[card.type] ?? 13
            const bold = st.b ?? isHeading
            const hasBg = !!st.bg
            const ink = st.color ?? (hasBg ? readableText(st.bg as string) : isHeading ? 'var(--text-primary)' : '#1a1a1a')
            const text: React.CSSProperties = { fontSize: fs, fontWeight: bold ? 600 : 400, fontStyle: st.i ? 'italic' : 'normal', textAlign: st.al ?? 'left', color: ink }

            const common: React.CSSProperties = {
              position: 'absolute',
              left: card.positionX,
              top: card.positionY,
              width: card.width ?? WIDTH[card.type] ?? 210,
              height: card.height ?? undefined,
              cursor: readOnly ? 'default' : panning ? 'inherit' : 'move',
              outline: isSel ? '2px solid var(--accent)' : hoverCardId === card.id ? '2px dashed var(--accent)' : 'none',
              outlineOffset: 3,
              borderRadius: 6,
            }
            const paper: React.CSSProperties = { ...PAPER, ...(hasBg ? { background: st.bg } : {}) }
            const frame: React.CSSProperties =
              card.type === 'column'
                ? { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', boxShadow: 'none' }
                : card.type === 'comment' && !hasBg
                  ? { background: '#e9f1ff', borderLeft: '3px solid #5b8def' }
                  : card.type === 'drawing' && !hasBg
                    ? { background: 'transparent', boxShadow: 'none' }
                    : {}
            const linkFull = card.type === 'link' && !!parseMeta(card.meta).image && !brokenImages.has(card.id)
            const pad = card.type === 'image' ? (hasBg ? 6 : 0) : card.type === 'drawing' ? 0 : card.type === 'color' || card.type === 'column' || linkFull ? 0 : card.type === 'video' || card.type === 'map' ? 6 : card.type === 'table' || card.type === 'sketch' ? 8 : 12
            const interactive = readOnly || (isSel && selected.size === 1)
            const gs = 22 / zoom // the grip stays the same size on screen however far you zoom
            const handles =
              isSel && !readOnly && selected.size === 1 ? (
                <div data-handle="se" title="Drag to resize" style={{ position: 'absolute', right: 4 / zoom, bottom: 4 / zoom, width: gs, height: gs, borderRadius: 6 / zoom, background: 'rgba(20,20,20,0.72)', color: '#fff', cursor: CURSOR.se, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 12 12" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ pointerEvents: 'none' }}><path d="M10 3L3 10M10 6.5L6.5 10M10 9.5L9.5 10" /></svg>
                </div>
              ) : null
            const heading = (
              <>
                {st.title && <div style={{ ...text, fontSize: fs * 1.2, fontWeight: 700, marginBottom: 2, overflowWrap: 'anywhere' }}>{st.title}</div>}
                {st.subtitle && card.type === 'note' && <div style={{ ...text, fontSize: fs * 0.9, fontWeight: 400, opacity: 0.7, marginBottom: 6, overflowWrap: 'anywhere' }}>{st.subtitle}</div>}
              </>
            )

            if (isHeading) {
              const box: React.CSSProperties = hasBg ? { ...paper, padding: '8px 12px', height: '100%', boxSizing: 'border-box' } : { height: '100%' }
              return (
                <div key={card.id} data-card data-card-id={card.id} className={popIds.has(card.id) ? 'card-pop' : undefined} data-selected={isSel || undefined} onDoubleClick={() => startEdit(card)} style={common}>
                  <div style={{ ...box, overflow: card.height ? 'hidden' : undefined }}>
                    {editing ? (
                      <textarea ref={editRef(!!card.height)} defaultValue={card.content} rows={1} onBlur={(e) => commitEdit(card, e.target.value)} onInput={(e) => !card.height && growBox(e.currentTarget)} onKeyDown={editKeys(true)} aria-label="Title text" style={{ ...text, display: 'block', width: '100%', height: card.height ? '100%' : undefined, fontFamily: SERIF, lineHeight: 1.25, padding: 0, margin: 0, background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: card.height ? 'auto' : 'hidden', userSelect: 'text' }} />
                    ) : (
                      <div data-body style={{ ...text, fontFamily: SERIF, lineHeight: 1.25, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '1.25em' }}>{card.content}</div>
                    )}
                    {st.subtitle && !editing && <div style={{ ...text, fontSize: fs * 0.6, fontWeight: 400, opacity: 0.7, marginTop: 4, overflowWrap: 'anywhere' }}>{st.subtitle}</div>}
                  </div>
                {handles}
                </div>
              )
            }

            if (card.type === 'board') {
              const info = inner[card.content]
              return (
                <div key={card.id} data-card data-card-id={card.id} className={popIds.has(card.id) ? 'card-pop' : undefined} data-selected={isSel || undefined} onDoubleClick={() => startEdit(card)} style={{ ...common, ...PAPER, padding: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 46, flexShrink: 0, borderRadius: '6px 6px 0 0', background: '#f1ece2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#8a7a5c' }} aria-hidden="true">▤</div>
                  <div style={{ padding: '10px 12px 12px', overflow: 'hidden' }}>
                    <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{info?.name ?? 'Board'}</div>
                    <div style={{ fontSize: 11, color: '#666', margin: '3px 0 8px' }}>
                      {info ? `${info.cards} ${info.cards === 1 ? 'card' : 'cards'}${info.boards > 0 ? ` · ${info.boards} ${info.boards === 1 ? 'board' : 'boards'} inside` : ''}` : ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <a href={`/brand-spaces/${brandSpaceId}/boards/${card.content}`} style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>Open →</a>
                      {!readOnly && <button type="button" onClick={() => renameTile(card)} style={{ fontSize: 11, padding: '2px 6px', background: 'transparent', color: '#555', border: '1px solid #ddd' }}>Rename</button>}
                    </div>
                  </div>
                  {handles}
                </div>
              )
            }

            return (
              <div key={card.id} data-card data-card-id={card.id} className={popIds.has(card.id) ? 'card-pop' : undefined} data-selected={isSel || undefined} onDoubleClick={() => startEdit(card)} style={{ ...common, ...paper, ...frame, ...(card.type === 'image' && !hasBg ? IMAGE_FRAME : {}), padding: pad, minHeight: card.type === 'column' && !card.height ? 360 : undefined, overflow: card.type === 'color' || card.height ? 'hidden' : undefined, boxSizing: 'border-box', display: card.type === 'color' ? 'flex' : undefined, flexDirection: card.type === 'color' ? 'column' : undefined }}>
                {(card.type === 'note' || card.type === 'comment') && (
                  <>
                    {heading}
                    {editing ? (
                      <textarea ref={editRef(!!card.height)} defaultValue={card.content} rows={1} onBlur={(e) => commitEdit(card, e.target.value)} onInput={(e) => !card.height && growBox(e.currentTarget)} onKeyDown={editKeys(false)} aria-label="Note text" style={{ ...text, display: 'block', width: '100%', height: card.height ? 'calc(100% - 4px)' : undefined, lineHeight: 1.45, padding: 0, margin: 0, background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: card.height ? 'auto' : 'hidden', userSelect: 'text' }} />
                    ) : (
                      <div data-body style={{ ...text, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '1.45em' }}>{card.content}</div>
                    )}
                  </>
                )}
                {card.type === 'image' && <img src={card.content} alt="" draggable={false} loading="lazy" decoding="async" style={{ width: '100%', borderRadius: hasBg ? 3 : 6, display: 'block' }} />}
                {card.type === 'link' && (() => {
                  const meta = parseMeta(card.meta)
                  const showImage = !!meta.image && !brokenImages.has(card.id)
                  const pending = card.meta == null
                  const site = siteLabel(card.content, meta.site)
                  const quiet = VISUAL_SITES.test(linkHost(card.content)) && showImage // pictures speak for themselves
                  const title = quiet ? '' : meta.title || ''
                  return (
                    <div style={{ color: hasBg ? ink : '#1a1a1a' }}>
                      {showImage && (
                        <div style={{ position: 'relative', borderRadius: '6px 6px 0 0', overflow: 'hidden', background: '#eee' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sharpImage(meta.image as string)} alt="" draggable={false} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBrokenImages((prev) => new Set(prev).add(card.id))} style={{ display: 'block', width: '100%', height: 'auto' }} />
                          {meta.kind === 'video' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, paddingLeft: 3 }}>▶</div>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ padding: showImage ? '8px 10px 9px' : '2px 0 0' }}>
                        {(title || !showImage) && (
                          <div style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.3, overflowWrap: 'anywhere', marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title || hostOf(card.content)}</div>
                        )}
                        <div style={{ fontSize: 11, opacity: pending ? 0.6 : 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pending ? (
                            'Loading preview…'
                          ) : (
                            <>
                              From{' '}
                              <a href={card.content} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)', textDecoration: 'none', fontWeight: 500 }}>{site}</a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
                {card.type === 'todo' && <TodoCard key={card.id} content={card.content} readOnly={readOnly} onChange={(text) => saveContent(card.id, text)} />}
                {card.type === 'color' && <ColorCard key={card.id} content={card.content} readOnly={readOnly} selected={isSel} autoFocus={popIds.has(card.id)} onChange={(text) => saveContent(card.id, text)} />}
                {card.type === 'table' && <TableCard key={card.id} content={card.content} readOnly={readOnly} selected={isSel} onChange={(text) => saveContent(card.id, text)} />}
                {card.type === 'document' && <DocumentCard key={card.id} content={card.content} readOnly={readOnly} open={editing} onOpen={() => setEditingId(card.id)} onClose={() => setEditingId(null)} onChange={(text) => saveContent(card.id, text)} />}
                {(card.type === 'sketch' || card.type === 'drawing') && <SketchCard key={card.id} content={card.content} editing={editing} readOnly={readOnly} transparent={card.type === 'drawing'} onChange={(text) => saveContent(card.id, text)} onDone={() => setEditingId(null)} />}
                {card.type === 'column' && <ColumnCard key={card.id} content={card.content} readOnly={readOnly} onChange={(text) => saveContent(card.id, text)} />}
                {card.type === 'audio' && <AudioCard content={card.content} interactive={interactive} />}
                {card.type === 'video' && <VideoCard content={card.content} interactive={interactive} />}
                {card.type === 'map' && <MapCard content={card.content} interactive={interactive} />}
                {handles}
              </div>
            )
          })}

          {(strokes.length > 0 || liveStroke) && (
            <svg aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: 45 }}>
              {[...strokes, ...(liveStroke ? [liveStroke] : [])].map((st, i) =>
                st.p.length === 1 ? (
                  <circle key={i} cx={st.p[0][0]} cy={st.p[0][1]} r={st.w / 2} fill={st.c} />
                ) : (
                  <polyline key={i} points={st.p.map((q) => q.join(',')).join(' ')} fill="none" stroke={st.c} strokeWidth={st.w} strokeLinecap="round" strokeLinejoin="round" />
                ),
              )}
            </svg>
          )}

          <LinesLayer lines={lineItems} boxOf={boxOf} selected={selected} zoom={zoom} readOnly={readOnly} draft={draftLine} onSelect={selectLine} />

          {uploads.map((u) => (
            <div key={u.id} data-nodrag style={{ position: 'absolute', left: u.x, top: u.y, width: WIDTH.image, minHeight: 96, borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.35)', background: 'var(--bg-card)', cursor: 'default' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.preview} alt="" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', display: 'block', opacity: u.status === 'error' ? 0.3 : 0.5 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, background: 'color-mix(in srgb, var(--bg-card) 88%, transparent)' }}>
                <UploadBar
                  item={u}
                  onCancel={u.status === 'saving' ? undefined : () => { uploadCtl.current.get(u.id)?.abort(); dropUpload(u.id) }}
                  onRetry={() => runUpload(u.id)}
                  onDismiss={() => dropUpload(u.id)}
                />
              </div>
            </div>
          ))}
        </div>

        {!readOnly && selectedLine && !draftLine && <LineToolbar line={selectedLine} boxOf={boxOf} pan={pan} zoom={zoom} onChange={(patch) => updateLine(selectedLine.id, (d) => ({ ...d, ...patch }))} onDelete={deleteSelected} />}
        {tool === 'draw' && !readOnly && (
          <div data-nodrag role="toolbar" aria-label="Drawing options" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-card)', border: '1px solid var(--accent-border)', borderRadius: 999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', whiteSpace: 'nowrap', maxWidth: 'calc(100% - 20px)', overflowX: 'auto' }}>
            {DRAWING_INKS.map((c) => (
              <button key={c} type="button" aria-label={`Pen color ${c}`} onClick={() => setPenColor(c)} style={{ width: 18, height: 18, minHeight: 0, padding: 0, flex: '0 0 auto', borderRadius: '50%', background: c, border: penColor === c ? '2px solid var(--accent)' : '2px solid var(--border-strong)', cursor: 'pointer' }} />
            ))}
            <span style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 2px' }} />
            {[2, 4, 8].map((s) => (
              <button key={s} type="button" aria-label={`Pen size ${s}`} onClick={() => setPenSize(s)} style={{ width: 24, height: 24, minHeight: 0, padding: 0, flex: '0 0 auto', borderRadius: '50%', border: 'none', background: penSize === s ? 'var(--accent-dim)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <span style={{ width: s + 3, height: s + 3, borderRadius: '50%', background: 'var(--text-primary)' }} />
              </button>
            ))}
            <span style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 2px' }} />
            <button type="button" onClick={() => setStrokes((prev) => prev.slice(0, -1))} disabled={strokes.length === 0} style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', padding: '4px 8px', minHeight: 0, fontSize: 12.5, cursor: 'pointer', opacity: strokes.length ? 1 : 0.4 }}>Undo</button>
            <button type="button" onClick={() => setTool('select')} style={{ border: 'none', background: 'var(--accent)', color: '#fff', padding: '5px 14px', minHeight: 0, borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Done</button>
          </div>
        )}
        {tool === 'line' && !readOnly && (
          <div aria-hidden="true" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 7, padding: '7px 14px', borderRadius: 999, background: 'var(--bg-card)', border: '1px solid var(--accent-border)', color: 'var(--accent-text)', fontSize: 12.5, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
            Drag from one card to another to connect them · Esc to stop
          </div>
        )}
        <CanvasScrollbars bounds={bounds} pan={pan} zoom={zoom} view={view} onPan={setPan} />

        {dropping && <div aria-hidden="true" style={{ position: 'absolute', inset: 8, border: '2px dashed var(--accent)', borderRadius: 8, background: 'rgba(255,105,41,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)', fontSize: 14, pointerEvents: 'none', zIndex: 5 }}>Drop images to add them to the board</div>}

        {marquee && <div aria-hidden="true" style={{ position: 'absolute', left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: '1px solid var(--accent)', background: 'rgba(255,105,41,0.12)', pointerEvents: 'none', zIndex: 4 }} />}

        {cards.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: '0 2rem', pointerEvents: 'none' }}>
            <div style={{ fontFamily: SERIF, fontSize: 20, color: 'var(--text-secondary)' }}>{readOnly ? 'This board is empty.' : 'Start your board'}</div>
            {!readOnly && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Pick a tool on the left, or drop images and paste links right onto the board.</div>}
          </div>
        )}
      </div>

      {!readOnly && selectedCards.length > 0 && anchor && (() => {
        // Above the card when there is room, below it when the card is near the top edge.
        const half = Math.min(250, (anchor.cw - 16) / 2)
        const left = Math.min(anchor.cw - half - 8, Math.max(half + 8, anchor.cx))
        const above = anchor.top >= 110
        return (
          <BoardInspector
            count={selectedCards.length}
            types={selectedCards.map((c) => c.type)}
            style={parseStyle(selectedCards[0].style)}
            single={single ? { id: single.id, type: single.type } : null}
            onStyle={applyStyle}
            onDelete={deleteSelected}
            pos={{ left, top: above ? anchor.top - 10 : anchor.bottom + 10, above }}
            manual={barPos}
            onMove={(x, y) => setBarPos({ x, y })}
            onReset={() => setBarPos(null)}
          />
        )
      })()}

        </div>
      </div>

      <div className="board-hint" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
        {readOnly
          ? 'Scroll or pinch to zoom · drag to move around'
          : 'Drop or paste images onto the board · scroll to move around · Ctrl + scroll to zoom'}
      </div>
    </div>
  )
}
