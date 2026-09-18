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

const NOTE_COLORS = ['#3a2e14', '#1f2e1a', '#2a1e30', '#1a2630', '#301c1c']

export default function BoardCanvas({ cards: initialCards }: { cards: Card[] }) {
  const [cards, setCards] = useState(initialCards)
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  // Deterministic-per-card slight rotation for a pinned-to-corkboard feel,
  // computed once so it doesn't jitter on every render.
  const rotations = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of initialCards) {
      let hash = 0
      for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) % 1000
      map.set(c.id, (hash % 7) - 3) // -3deg to +3deg
    }
    return map
  }, [initialCards])

  function colorFor(id: string) {
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 1000
    return NOTE_COLORS[hash % NOTE_COLORS.length]
  }

  function handlePointerDown(e: React.PointerEvent, card: Card) {
    const rect = (e.target as HTMLElement).closest('[data-card]')?.getBoundingClientRect()
    if (!rect) return
    dragState.current = { id: card.id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent, containerRect: DOMRect) {
    if (!dragState.current) return
    const { id, offsetX, offsetY } = dragState.current
    const x = e.clientX - containerRect.left - offsetX
    const y = e.clientY - containerRect.top - offsetY
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, positionX: x, positionY: y } : c)))
  }

  function handlePointerUp() {
    if (!dragState.current) return
    const { id } = dragState.current
    const card = cards.find((c) => c.id === id)
    dragState.current = null
    if (card) moveBoardCard(id, card.positionX, card.positionY)
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '70vh',
        minHeight: 460,
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background:
          'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px) 0 0 / 22px 22px, var(--bg-card)',
      }}
      onPointerMove={(e) => handlePointerMove(e, e.currentTarget.getBoundingClientRect())}
      onPointerUp={handlePointerUp}
    >
      {cards.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--text-muted)', textAlign: 'center', padding: '0 2rem' }}>
          <div style={{ fontSize: 28 }}>📌</div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>This board is empty.</div>
          <div style={{ fontSize: 12.5 }}>Pin up a shot list, a mood reference, a location photo — anything. Just start dropping things in.</div>
        </div>
      )}

      {cards.map((card) => (
        <div
          key={card.id}
          data-card
          onPointerDown={(e) => handlePointerDown(e, card)}
          style={{
            position: 'absolute',
            left: card.positionX,
            top: card.positionY,
            width: 180,
            padding: 10,
            background: card.type === 'note' ? colorFor(card.id) : 'var(--bg-app)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            cursor: 'grab',
            userSelect: 'none',
            boxShadow: '0 8px 18px rgba(0,0,0,0.45)',
            transform: `rotate(${rotations.get(card.id) || 0}deg)`,
            transition: 'transform 0.15s ease',
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
  )
}
