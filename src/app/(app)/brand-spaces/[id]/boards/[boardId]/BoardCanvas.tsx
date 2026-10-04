'use client'

import { useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { addBoardCardAt, moveBoardCard, deleteBoardCard, updateBoardCard } from '../actions'

type Card = { id: string; type: string; content: string; positionX: number; positionY: number }

type DragState =
  | { kind: 'card'; id: string; lastX: number; lastY: number; moved: boolean }
  | { kind: 'pan'; lastX: number; lastY: number }

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5
const WIDTH: Record<string, number> = { note: 210, heading: 320, image: 220, link: 210, color: 140 }
const SERIF = "Georgia, 'Times New Roman', serif"
const PAPER: React.CSSProperties = {
  background: '#ffffff',
  color: '#1a1a1a',
  borderRadius: 6,
  boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.25)',
}

function parseColor(content: string) {
  const [hex = '#888888', role = '', use = ''] = content.split('|')
  return { hex, role, use }
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function BoardCanvas({ boardId, cards: initialCards, readOnly = false }: { boardId: string; cards: Card[]; readOnly?: boolean }) {
  const [cards, setCards] = useState(initialCards)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dragState = useRef<DragState | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchDist = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button, textarea, input, a')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      // Two fingers: pinch to zoom instead of dragging.
      const [a, b] = Array.from(pointers.current.values())
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y)
      dragState.current = null
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    const cardEl = target.closest('[data-card]') as HTMLElement | null
    if (cardEl && !readOnly) {
      dragState.current = { kind: 'card', id: cardEl.dataset.cardId as string, lastX: e.clientX, lastY: e.clientY, moved: false }
    } else {
      dragState.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY }
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
    const drag = dragState.current
    if (!drag) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY
    if (drag.kind === 'card') {
      drag.moved = true
      setCards((prev) => prev.map((c) => (c.id === drag.id ? { ...c, positionX: c.positionX + dx / zoom, positionY: c.positionY + dy / zoom } : c)))
    } else {
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
    }
    drag.lastX = e.clientX
    drag.lastY = e.clientY
  }

  function handlePointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchDist.current = null
    if (pointers.current.size === 1 && !dragState.current) {
      // One finger left after a pinch: carry on as a pan, without a jump.
      const [p] = Array.from(pointers.current.values())
      dragState.current = { kind: 'pan', lastX: p.x, lastY: p.y }
      return
    }
    const drag = dragState.current
    if (drag?.kind === 'card' && drag.moved) {
      const card = cards.find((c) => c.id === drag.id)
      if (card) moveBoardCard(card.id, card.positionX, card.positionY).catch(() => {})
    }
    dragState.current = null
  }

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

  // New cards appear in the middle of what you are looking at.
  async function addCard(type: string, content: string) {
    const rect = containerRef.current?.getBoundingClientRect()
    const w = WIDTH[type] ?? 210
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 200
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 150
    const x = cx - w / 2 + (Math.random() - 0.5) * 60
    const y = cy - 50 + (Math.random() - 0.5) * 60
    try {
      const created = await addBoardCardAt(boardId, type, content, x, y)
      setCards((prev) => [...prev, created])
      if (type === 'note' || type === 'heading') setEditingId(created.id)
    } catch {
      alert('Could not add that card. Please try again.')
    }
  }

  function addLink() {
    const raw = prompt('Paste a link')?.trim()
    if (!raw) return
    addCard('link', /^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  }

  function askColor(current = { hex: '#', role: '', use: '' }) {
    const hex = prompt('Color code, like #ED8D01', current.hex)?.trim()
    if (!hex || !/^#[0-9a-f]{3,8}$/i.test(hex)) {
      if (hex) alert('That does not look like a color code. Use something like #ED8D01.')
      return null
    }
    const role = prompt('What is this color called? (Primary, Accent…)', current.role) ?? current.role
    const use = prompt('What is it used for?', current.use) ?? current.use
    return `${hex}|${role}|${use}`
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const blob = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/upload' })
      await addCard('image', blob.url)
    } catch {
      alert('Upload failed. Check that the file is an image under 500 MB.')
    } finally {
      setBusy(false)
    }
  }

  function commitEdit(card: Card, value: string) {
    setEditingId(null)
    const text = value.trim()
    if (!text) {
      setCards((prev) => prev.filter((c) => c.id !== card.id))
      deleteBoardCard(card.id).catch(() => {})
      return
    }
    if (text === card.content) return
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, content: text } : c)))
    updateBoardCard(card.id, text).catch(() => {})
  }

  function startEdit(card: Card) {
    if (readOnly) return
    if (card.type === 'note' || card.type === 'heading') return setEditingId(card.id)
    if (card.type === 'link') {
      const next = prompt('Edit link', card.content)?.trim()
      if (next) commitEdit(card, /^https?:\/\//i.test(next) ? next : `https://${next}`)
    }
    if (card.type === 'color') {
      const next = askColor(parseColor(card.content))
      if (next) commitEdit(card, next)
    }
  }

  const tools = [
    { label: 'Note', glyph: '≡', run: () => addCard('note', '') },
    { label: 'Title', glyph: 'T', run: () => addCard('heading', '') },
    { label: 'Image', glyph: '▣', run: () => fileRef.current?.click() },
    { label: 'Link', glyph: '∞', run: addLink },
    { label: 'Color', glyph: '●', run: () => { const v = askColor(); if (v) addCard('color', v) } },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', gap: 6 }}>
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
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </div>
      )}

      <div
        ref={containerRef}
        className="canvas-box"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ position: 'relative', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', background: 'var(--bg-app)', cursor: 'grab', touchAction: 'none' }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', backgroundImage: 'radial-gradient(circle, var(--canvas-dot) 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          {cards.map((card) => {
            const editing = editingId === card.id
            const common: React.CSSProperties = { position: 'absolute', left: card.positionX, top: card.positionY, width: WIDTH[card.type] ?? 210, cursor: readOnly ? 'default' : 'move' }
            const del = !readOnly && (
              <button type="button" aria-label="Delete card" onClick={() => { setCards((p) => p.filter((c) => c.id !== card.id)); deleteBoardCard(card.id).catch(() => {}) }} style={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, padding: 0, borderRadius: '50%', fontSize: 12, lineHeight: '18px', background: 'var(--bg-card)' }}>×</button>
            )

            if (card.type === 'heading') {
              return (
                <div key={card.id} data-card data-card-id={card.id} onDoubleClick={() => startEdit(card)} style={common}>
                  {editing ? (
                    <textarea autoFocus defaultValue={card.content} onBlur={(e) => commitEdit(card, e.target.value)} rows={2} style={{ width: '100%', fontFamily: SERIF, fontSize: 22, fontWeight: 600, background: 'transparent', color: 'var(--text-primary)', border: '1px dashed var(--border-strong)', resize: 'none' }} />
                  ) : (
                    <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.25, whiteSpace: 'pre-wrap', userSelect: 'none' }}>{card.content}</div>
                  )}
                  {del}
                </div>
              )
            }

            return (
              <div key={card.id} data-card data-card-id={card.id} onDoubleClick={() => startEdit(card)} style={{ ...common, ...PAPER, padding: card.type === 'image' ? 6 : card.type === 'color' ? 0 : 12, overflow: card.type === 'color' ? 'hidden' : undefined }}>
                {card.type === 'note' && (editing ? (
                  <textarea autoFocus defaultValue={card.content} onBlur={(e) => commitEdit(card, e.target.value)} rows={5} style={{ width: '100%', fontSize: 13, background: 'transparent', color: '#1a1a1a', border: 'none', outline: 'none', resize: 'vertical' }} />
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap', userSelect: 'none' }}>{card.content}</div>
                ))}
                {card.type === 'image' && <img src={card.content} alt="" draggable={false} style={{ width: '100%', borderRadius: 3, display: 'block' }} />}
                {card.type === 'link' && (
                  <a href={card.content} target="_blank" rel="noreferrer" style={{ display: 'block', color: '#1a1a1a' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{hostOf(card.content)}</div>
                    <div style={{ fontSize: 11, color: '#666', wordBreak: 'break-all' }}>{card.content}</div>
                  </a>
                )}
                {card.type === 'color' && (() => {
                  const { hex, role, use } = parseColor(card.content)
                  return (
                    <div>
                      <div style={{ height: 64, background: hex }} />
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{hex.toUpperCase()}</div>
                        {role && <div style={{ fontSize: 12 }}>{role}</div>}
                        {use && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{use}</div>}
                      </div>
                    </div>
                  )
                })()}
                {del}
              </div>
            )
          })}
        </div>

        {cards.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: '0 2rem', pointerEvents: 'none' }}>
            <div style={{ fontFamily: SERIF, fontSize: 20, color: 'var(--text-secondary)' }}>{readOnly ? 'This board is empty.' : 'Start your board'}</div>
            {!readOnly && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Pick a tool on the left to add a note, a title, an image, a link or a color.</div>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
        Scroll or pinch to zoom · drag empty space to move around{readOnly ? '' : ' · drag a card to move it · double-click to edit'}
      </div>
    </div>
  )
}
