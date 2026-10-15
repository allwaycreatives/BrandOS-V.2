'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { uploadImage } from '@/lib/uploadImage'
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
import { DEFAULT_COLOR, parseColorCard, serializeColorCard, type ColorCard } from '@/lib/boardColor'
import { HANDLES, movedEnough, normalizeRect, resizeRect, selectOnDown, type Handle, type Rect } from '@/lib/boardGeometry'
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
type Inner = { id: string; name: string; cards: number; boards: number }
type Meta = { title?: string; image?: string; kind?: string; site?: string }

type Drag =
  | { kind: 'cards'; ids: string[]; startX: number; startY: number; origin: Map<string, { x: number; y: number }>; dx: number; dy: number; moved: boolean; clickedId: string; additive: boolean; onUp: 'collapse' | 'remove' | null }
  | { kind: 'pan'; lastX: number; lastY: number }
  | { kind: 'marquee'; sx: number; sy: number; additive: boolean; base: Set<string>; moved: boolean }
  | { kind: 'resize'; id: string; handle: Handle; start: Rect; hadHeight: boolean; startX: number; startY: number; last: Rect }

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5
const WIDTH: Record<string, number> = { note: 210, heading: 320, image: 220, link: 240, color: 140, board: 200 }
const SERIF = "Georgia, 'Times New Roman', serif"
const PAPER: React.CSSProperties = {
  background: '#ffffff',
  color: '#1a1a1a',
  borderRadius: 6,
  boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.25)',
}
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
  const [tool, setTool] = useState<'select' | 'hand'>('select')
  const [multi, setMulti] = useState(false) // taps add to the selection (for phones, and for anyone who forgets Shift)
  const [spaceDown, setSpaceDown] = useState(false)
  const [marquee, setMarquee] = useState<Rect | null>(null)
  const [cursorGrab, setCursorGrab] = useState(false)
  const [anchor, setAnchor] = useState<{ cx: number; top: number; bottom: number; cw: number } | null>(null)
  const [dialog, setDialog] = useState<{ kind: 'link' | 'board' | 'rename' | 'editlink'; cardId?: string; initial: string } | null>(null)
  const [notice, setNotice] = useState<{ kind: 'error' | 'info' | 'progress'; text: string; percent?: number | null } | null>(null)
  const [barPos, setBarPos] = useState<{ x: number; y: number } | null>(null)
  const [newColorId, setNewColorId] = useState<string | null>(null)

  const selRef = useRef(selected)
  const dragRef = useRef<Drag | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const caretRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>()
  const colorTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const setSelected = (next: Set<string>) => {
    selRef.current = next
    setSelectedState(next)
  }

  // ---------- pointer handling ----------

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
      setMarquee(null)
      el.setPointerCapture?.(e.pointerId)
      return
    }

    const handleEl = target.closest('[data-handle]') as HTMLElement | null
    const cardEl = target.closest('[data-card]') as HTMLElement | null
    const panWanted = readOnly || tool === 'hand' || spaceDown || e.button === 1

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
      const origin = new Map<string, { x: number; y: number }>()
      for (const cid of sel.dragIds) {
        const c = cards.find((x) => x.id === cid)
        if (c) origin.set(cid, { x: c.positionX, y: c.positionY })
      }
      dragRef.current = { kind: 'cards', ids: sel.dragIds, startX: e.clientX, startY: e.clientY, origin, dx: 0, dy: 0, moved: false, clickedId: id, additive, onUp: sel.onUp }
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
      const r = resizeRect(drag.start, drag.handle, (e.clientX - drag.startX) / zoom, (e.clientY - drag.startY) / zoom, min, MAX_CARD_SIZE, card.type === 'image')
      drag.last = r
      const vertical = drag.handle.includes('n') || drag.handle.includes('s')
      const setHeight = card.type !== 'image' && (vertical || drag.hadHeight)
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
      } else {
        if (drag.onUp === 'collapse') setSelected(new Set([drag.clickedId]))
        else if (drag.onUp === 'remove') {
          const next = new Set(selRef.current)
          next.delete(drag.clickedId)
          setSelected(next)
        }
        // A plain click (not a drag, not an add-to-selection click) on a note or a title: just start typing.
        const clicked = cardsRef.current.find((c) => c.id === drag.clickedId)
        if (!drag.additive && clicked && (clicked.type === 'note' || clicked.type === 'heading')) {
          caretRef.current = caretOffsetAt(e.clientX, e.clientY, containerRef.current?.querySelector<HTMLElement>(`[data-card-id="${clicked.id}"]`) ?? null)
          setEditingId(clicked.id)
        }
      }
    } else if (drag.kind === 'resize') {
      const card = cards.find((c) => c.id === drag.id)
      const r = drag.last
      const vertical = drag.handle.includes('n') || drag.handle.includes('s')
      const keepHeight = card && card.type !== 'image' && (vertical || drag.hadHeight)
      if (card) resizeBoardCard(boardId, drag.id, { x: r.x, y: r.y, w: r.w, h: keepHeight ? r.h : null }).catch(() => {})
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
  const wheelRef = useRef<(e: WheelEvent) => void>()
  wheelRef.current = (e) => zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.08 : 1 / 1.08)
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

  function zoomButton(factor: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  // ---------- keyboard ----------

  const deleteRef = useRef<() => void>()
  deleteRef.current = deleteSelected
  useEffect(() => {
    const typingIn = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    }
    const onDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (typingIn(e.target)) return
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
  }, [selected, cards, pan, zoom, editingId, readOnly])

  useEffect(() => {
    if (newColorId && !(selected.size === 1 && selected.has(newColorId))) setNewColorId(null)
  }, [selected, newColorId])

  // Leaving the board: save any colour change that was still waiting for its half-second.
  useEffect(() => {
    const timers = colorTimers.current
    return () => {
      timers.forEach((t, id) => {
        clearTimeout(t)
        const latest = cardsRef.current.find((c) => c.id === id)
        if (latest) updateBoardCard(id, latest.content).catch(() => {})
      })
    }
  }, [])

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

  // A message on the board (instead of a browser alert box). Errors fade after a few seconds; progress stays until it is done.
  function notify(text: string, kind: 'error' | 'info' = 'error') {
    setNotice({ kind, text })
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice((n) => (n && n.kind !== 'progress' ? null : n)), 7000)
  }

  // New cards appear in the middle of what you are looking at.
  async function addCard(type: string, content: string) {
    const rect = containerRef.current?.getBoundingClientRect()
    const w = WIDTH[type] ?? 210
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 150
    const x = cx - w / 2 + (Math.random() - 0.5) * 60
    const y = cy - 50 + (Math.random() - 0.5) * 60
    try {
      const { inner: innerInfo, ...created } = await addBoardCardAt(boardId, type, content, x, y)
      setCards((prev) => [...prev, created])
      setSelected(new Set([created.id]))
      if (innerInfo) setInner((prev) => ({ ...prev, [innerInfo.id]: innerInfo }))
      if (type === 'note' || type === 'heading') setEditingId(created.id)
      if (type === 'color') setNewColorId(created.id)
    } catch (err) {
      notify(err instanceof Error && /levels deep|name|link|colour/.test(err.message) ? err.message : 'Could not add that card. Please try again.')
    }
  }

  // Pictures go through one helper (src/lib/uploadImage.ts). This only shows what is happening and adds the card.
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const label = files.length > 1 ? `Uploading ${i + 1} of ${files.length}: ${file.name}` : `Uploading ${file.name}`
        setNotice({ kind: 'progress', text: label, percent: null })
        const { url } = await uploadImage(file, {
          signal: controller.signal,
          onProgress: (p) => setNotice({ kind: 'progress', text: p.stage ? `${label} · ${p.stage}` : label, percent: p.percent }),
        })
        await addCard('image', url)
      }
      setNotice(null)
    } catch (err) {
      if (controller.signal.aborted) setNotice(null)
      else notify(err instanceof Error && err.message ? `Upload failed: ${err.message}` : 'Upload failed. Please try again.')
    } finally {
      abortRef.current = null
      setBusy(false)
    }
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
    setCards((prev) => prev.filter((c) => !gone.has(c.id)))
    setSelected(new Set())
    deleteBoardCards(boardId, ids).catch(() => notify('Could not delete. Please refresh and try again.'))
  }
  const idsHas = (ids: string[], id: string) => ids.includes(id)

  // What the little input box does when you press Enter.
  async function submitDialog(value: string) {
    const d = dialog
    setDialog(null)
    if (!d) return
    const card = d.cardId ? cardsRef.current.find((c) => c.id === d.cardId) : undefined
    if (d.kind === 'link') {
      setBusy(true)
      try {
        await addCard('link', /^https?:\/\//i.test(value) ? value : `https://${value}`)
      } finally {
        setBusy(false)
      }
    } else if (d.kind === 'editlink') {
      if (card) commitEdit(card, /^https?:\/\//i.test(value) ? value : `https://${value}`)
    } else if (d.kind === 'board') {
      await addCard('board', value)
    } else if (d.kind === 'rename' && card) {
      if (value === (inner[card.content]?.name ?? '')) return
      setInner((prev) => ({ ...prev, [card.content]: { ...(prev[card.content] as Inner), name: value } }))
      renameBoardTile(card.id, value).catch(() => notify('Could not rename that board. Please try again.'))
    }
  }

  // Colour cards: the colour, plus an optional name, type and use. Saved a moment after typing stops.
  function applyColor(patch: Partial<ColorCard>) {
    const id = selRef.current.size === 1 ? Array.from(selRef.current)[0] : null
    const target = id ? cardsRef.current.find((c) => c.id === id) : undefined
    if (!id || !target || target.type !== 'color') return
    const next = serializeColorCard({ ...parseColorCard(target.content), ...patch })
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, content: next } : c)))
    const timers = colorTimers.current
    const pending = timers.get(id)
    if (pending) clearTimeout(pending)
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id)
        const latest = cardsRef.current.find((c) => c.id === id)
        if (latest) updateBoardCard(id, latest.content).catch(() => notify('Could not save that colour. Please try again.'))
      }, 500)
    )
  }

  function openBoard(card: Card) {
    if (brandSpaceId) router.push(`/brand-spaces/${brandSpaceId}/boards/${card.content}`)
  }

  function renameTile(card: Card) {
    setDialog({ kind: 'rename', cardId: card.id, initial: inner[card.content]?.name ?? '' })
  }

  function startEdit(card: Card) {
    if (card.type === 'board') return openBoard(card)
    if (readOnly) return
    if (card.type === 'note' || card.type === 'heading') return setEditingId(card.id)
    if (card.type === 'link') setDialog({ kind: 'editlink', cardId: card.id, initial: card.content })
    // A colour card is edited in the bar above it, so there is nothing to open here.
  }

  const tools = [
    { label: 'Note', glyph: '≡', run: () => addCard('note', '') },
    { label: 'Title', glyph: 'T', run: () => addCard('heading', '') },
    { label: 'Image', glyph: '▣', run: () => fileRef.current?.click() },
    { label: 'Link', glyph: '∞', run: () => setDialog({ kind: 'link', initial: '' }) },
    ...(canNest
      ? [{ label: 'Board', glyph: '▤', run: () => setDialog({ kind: 'board', initial: '' }) }]
      : []),
    { label: 'Color', glyph: '●', run: () => addCard('color', serializeColorCard({ hex: DEFAULT_COLOR })) },
  ]

  // ---------- drawing ----------

  const selectedCards = cards.filter((c) => selected.has(c.id))
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
    <div style={{ position: 'relative' }}>
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

      {!readOnly && (
        <div className="canvas-tools">
          {tools.map((t) => (
            <button key={t.label} type="button" onClick={t.run} disabled={busy} title={`Add ${t.label.toLowerCase()}`} style={{ width: 54, padding: '7px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, border: 'none', background: 'transparent' }}>
              <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">{t.glyph}</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{t.label === 'Image' && busy ? '...' : t.label}</span>
            </button>
          ))}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} style={{ display: 'none' }} />
        </div>
      )}

      {dialog && (
        <BoardPrompt
          key={`${dialog.kind}-${dialog.cardId ?? ''}`}
          title={{ link: 'Paste a link', board: 'Name this board', rename: 'Rename this board', editlink: 'Edit link' }[dialog.kind]}
          placeholder={{ link: 'https://…', board: 'For example: Inspirations', rename: 'Board name', editlink: 'https://…' }[dialog.kind]}
          initial={dialog.initial}
          submitLabel={{ link: 'Add', board: 'Create', rename: 'Save', editlink: 'Save' }[dialog.kind]}
          onSubmit={submitDialog}
          onCancel={() => setDialog(null)}
        />
      )}

      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 7, width: 340, maxWidth: 'calc(100% - 200px)', background: 'var(--bg-card)', border: `1px solid ${notice.kind === 'error' ? 'var(--accent-border)' : 'var(--border-strong)'}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12.5, color: notice.kind === 'error' ? 'var(--accent-text)' : 'var(--text-primary)', overflowWrap: 'anywhere' }}>{notice.text}</div>
            {notice.kind === 'progress' ? (
              <button type="button" onClick={() => abortRef.current?.abort()} style={{ fontSize: 12, flexShrink: 0 }}>Cancel</button>
            ) : (
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" style={{ fontSize: 14, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>×</button>
            )}
          </div>
          {notice.kind === 'progress' && (
            <div className="progress-track" style={{ marginTop: 8 }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={notice.percent ?? undefined}>
              {notice.percent == null ? <div className="progress-indeterminate" /> : <div className="progress-fill" style={{ width: `${Math.max(2, Math.min(100, notice.percent))}%` }} />}
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        className="canvas-box"
        data-testid="canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ position: 'relative', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-app)', cursor: readOnly || panning || cursorGrab ? (cursorGrab ? 'grabbing' : 'grab') : marquee ? 'crosshair' : 'default', touchAction: 'none', userSelect: 'none' }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          {cards.map((card) => {
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
              outline: isSel ? '2px solid var(--accent)' : 'none',
              outlineOffset: 3,
              borderRadius: 6,
            }
            const paper: React.CSSProperties = { ...PAPER, ...(hasBg ? { background: st.bg } : {}) }
            const handles =
              isSel && !readOnly && selected.size === 1
                ? HANDLES.filter((h) => !(card.type === 'image' && (h === 'n' || h === 's'))).map((h) => (
                    <div key={h} data-handle={h} style={{ position: 'absolute', left: HANDLE_POS[h].l, top: HANDLE_POS[h].t, width: hs, height: hs, marginLeft: -hs / 2, marginTop: -hs / 2, background: '#ffffff', border: `${1.5 / zoom}px solid var(--accent)`, borderRadius: 2, cursor: CURSOR[h], zIndex: 3 }} />
                  ))
                : null
            const heading = (
              <>
                {st.title && <div style={{ ...text, fontSize: fs * 1.2, fontWeight: 700, marginBottom: 2, overflowWrap: 'anywhere' }}>{st.title}</div>}
                {st.subtitle && card.type === 'note' && <div style={{ ...text, fontSize: fs * 0.9, fontWeight: 400, opacity: 0.7, marginBottom: 6, overflowWrap: 'anywhere' }}>{st.subtitle}</div>}
              </>
            )

            if (isHeading) {
              const box: React.CSSProperties = hasBg ? { ...paper, padding: '8px 12px', height: '100%', boxSizing: 'border-box' } : { height: '100%' }
              return (
                <div key={card.id} data-card data-card-id={card.id} data-selected={isSel || undefined} onDoubleClick={() => startEdit(card)} style={common}>
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
                <div key={card.id} data-card data-card-id={card.id} data-selected={isSel || undefined} onDoubleClick={() => startEdit(card)} style={{ ...common, ...PAPER, padding: 0, display: 'flex', flexDirection: 'column' }}>
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
              <div key={card.id} data-card data-card-id={card.id} data-selected={isSel || undefined} onDoubleClick={() => startEdit(card)} style={{ ...common, ...paper, padding: card.type === 'image' ? 6 : card.type === 'color' ? 0 : 12, overflow: card.type === 'color' || card.height ? 'hidden' : undefined, boxSizing: 'border-box', display: card.type === 'color' ? 'flex' : undefined, flexDirection: card.type === 'color' ? 'column' : undefined }}>
                {card.type === 'note' && (
                  <>
                    {heading}
                    {editing ? (
                      <textarea ref={editRef(!!card.height)} defaultValue={card.content} rows={1} onBlur={(e) => commitEdit(card, e.target.value)} onInput={(e) => !card.height && growBox(e.currentTarget)} onKeyDown={editKeys(false)} aria-label="Note text" style={{ ...text, display: 'block', width: '100%', height: card.height ? 'calc(100% - 4px)' : undefined, lineHeight: 1.45, padding: 0, margin: 0, background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: card.height ? 'auto' : 'hidden', userSelect: 'text' }} />
                    ) : (
                      <div data-body style={{ ...text, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '1.45em' }}>{card.content}</div>
                    )}
                  </>
                )}
                {card.type === 'image' && <img src={card.content} alt="" draggable={false} style={{ width: '100%', borderRadius: 3, display: 'block' }} />}
                {card.type === 'link' && (() => {
                  const meta = parseMeta(card.meta)
                  const showImage = !!meta.image && !brokenImages.has(card.id)
                  const pending = card.meta == null
                  return (
                    <div style={{ color: hasBg ? ink : '#1a1a1a' }}>
                      {showImage && (
                        <div style={{ position: 'relative', margin: '-12px -12px 10px', borderRadius: '6px 6px 0 0', overflow: 'hidden', background: '#eee' }}>
                          <img src={meta.image} alt="" draggable={false} referrerPolicy="no-referrer" onError={() => setBrokenImages((prev) => new Set(prev).add(card.id))} style={{ display: 'block', width: '100%', maxHeight: 170, objectFit: 'cover' }} />
                          {meta.kind === 'video' && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, paddingLeft: 3 }}>▶</div>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{meta.title || hostOf(card.content)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 11, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pending ? 'Loading preview…' : meta.site || hostOf(card.content)}</span>
                        <a href={card.content} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: 'inherit', fontWeight: 600, flexShrink: 0 }}>Open ↗</a>
                      </div>
                    </div>
                  )
                })()}
                {card.type === 'color' && (() => {
                  const c = parseColorCard(card.content)
                  return (
                    <>
                      <div style={{ height: card.height ? undefined : 64, flex: card.height ? 1 : undefined, minHeight: 30, background: c.hex || '#888888' }} />
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{c.hex ? c.hex.toUpperCase() : 'No colour yet'}</div>
                        {c.more && (
                          <>
                            {c.name && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, overflowWrap: 'anywhere' }}>{c.name}</div>}
                            {c.type && <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#666', marginTop: 2 }}>{c.type}</div>}
                            {c.use && <div style={{ fontSize: 11.5, color: '#555', marginTop: 4, overflowWrap: 'anywhere' }}>{c.use}</div>}
                            {!c.name && !c.type && !c.use && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Add details in the bar above</div>}
                          </>
                        )}
                      </div>
                    </>
                  )
                })()}
                {handles}
              </div>
            )
          })}
        </div>

        {marquee && <div aria-hidden="true" style={{ position: 'absolute', left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: '1px solid var(--accent)', background: 'rgba(255,105,41,0.12)', pointerEvents: 'none', zIndex: 4 }} />}

        {cards.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: '0 2rem', pointerEvents: 'none' }}>
            <div style={{ fontFamily: SERIF, fontSize: 20, color: 'var(--text-secondary)' }}>{readOnly ? 'This board is empty.' : 'Start your board'}</div>
            {!readOnly && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Pick a tool on the left to add a note, a title, an image, a link or a color.</div>}
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
            colorCard={single && single.type === 'color' ? parseColorCard(single.content) : null}
            onColor={applyColor}
            autoFocusHex={!!single && single.id === newColorId}
          />
        )
      })()}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
        {readOnly
          ? 'Scroll or pinch to zoom · drag to move around'
          : 'Click a note to type · drag empty space to select several cards · hold Space or use Move to pan · Shift-click adds to a selection · scroll or pinch to zoom'}
      </div>
    </div>
  )
}
