'use client'

import { useMemo, useRef, useState } from 'react'
import { moveBoardCard, deleteBoardCard } from '../actions'

type Card = {
  id: string
  type: string
  content: string
  positionX: number
  positionY: number
}

type DragState =
  | { kind: 'card'; id: string; lastX: number; lastY: number }
  | { kind: 'pan'; lastX: number; lastY: number }

const NOTE_COLORS = ['#3a2e14', '#1f2e1a', '#2a1e30', '#1a2630', '#301c1c']
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5

export default function BoardCanvas({ cards: initialCards }: { cards: Card[] }) {
  const [cards, setCards] = useState(initialCards)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragState = useRef<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const rotations = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of initialCards) {
      let hash = 0
      for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) % 1000
      map.set(c.id, (hash % 7) - 3)
    }
    return map
  }, [initialCards])

  function colorFor(id: string) {
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000
    return NOTE_COLORS[hash % NOTE_COLORS.length]
  }

  function handlePointerDown(e: React.PointerEvent) {
    const cardEl = (e.target as HTMLElement).closest('[data-card]') as HTMLElement | null
    if (cardEl) {
      dragState.current = { kind: 'card', id: cardEl.dataset.cardId as string, lastX: e.clientX, lastY: e.clientY }
    } else {
      dragState.current = { kind: 'pan', lastX: e.clientX, lastY: e.clientY }
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragState.current
    if (!drag) return
    const dx = e.clientX - drag.lastX
    const dy = e.clientY - drag.lastY

    if (drag.kind === 'card') {
      setCards((prev) =>
        prev.map((c) => (c.id === drag.id ? { ...c, positionX: c.positionX + dx / zoom, positionY: c.positionY + dy / zoom } : c))
      )
      dragState.current = { ...drag, lastX: e.clientX, lastY: e.clientY }
    } else {
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      dragState.current = { ...drag, lastX: e.clientX, lastY: e.clientY }
    }
  }

  function handlePointerUp() {
    const drag = dragState.current
    if (drag?.kind === 'card') {
      const card = cards.find((c) => c.id === drag.id)
      if (card) moveBoardCard(card.id, card.positionX, card.positionY)
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

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
    zoomAt(e.clientX, e.clientY, factor)
  }

  function handleZoomButton(factor: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor)
  }

  function resetView() {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => handleZoomButton(1 / 1.2)} style={{ padding: '4px 10px' }}>−</button>
        <button type="button" onClick={resetView} style={{ padding: '4px 10px', fontSize: 11 }}>{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => handleZoomButton(1.2)} style={{ padding: '4px 10px' }}>+</button>
      </div>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{
          position: 'relative',
          width: '100%',
          height: '70vh',
          minHeight: 460,
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          background: 'var(--bg-card)',
          cursor: dragState.current?.kind === 'pan' ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          {cards.map((card) => (
            <div
              key={card.id}
              data-card
              data-card-id={card.id}
              style={{
                position: 'absolute',
                left: card.positionX,
                top: card.positionY,
                width: 180,
                padding: 10,
                background: card.type === 'note' ? colorFor(card.id) : 'var(--bg-app)',
                border: '1px solid var(--border-strong)',
                borderRadius: 10,
                userSelect: 'none',
                boxShadow: '0 8px 18px rgba(0,0,0,0.45)',
                transform: `rotate(${rotations.get(card.id) || 0}deg)`,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCards((prev) => prev.filter((c) => c.id !== card.id))
                  deleteBoardCard(card.id)
                }}
                style={{ float: 'right', padding: '0 6px', fontSize: 11, lineHeight: '18px' }}
              >
                ×
              </button>

              {card.type === 'image' ? (
                <img src={card.content} alt="" style={{ width: '100%', borderRadius: 6, display: 'block', marginTop: 18 }} />
              ) : card.type === 'link' ? (
                <a
                  href={card.content}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12.5, color: 'var(--accent)', wordBreak: 'break-all', display: 'block', marginTop: 18 }}
                >
                  {card.content}
                </a>
              ) : (
                <div style={{ fontSize: 12.5, marginTop: 18, whiteSpace: 'pre-wrap', color: '#f2f2f2' }}>{card.content}</div>
              )}
            </div>
          ))}
        </div>

        {cards.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', textAlign: 'center', padding: '0 2rem', pointerEvents: 'none' }}>
            <div style={{ fontSize: 28 }}>📌</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>This board is empty.</div>
            <div style={{ fontSize: 12.5 }}>Pin up a shot list, a mood reference, a location photo — anything. Just start dropping things in.</div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
        Scroll to zoom · drag empty space to pan · drag a card to move it
      </div>
    </div>
  )
}
