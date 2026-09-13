'use client'

import { useRef, useState } from 'react'
import { moveBoardCard, deleteBoardCard } from './actions'

type Card = {
  id: string
  type: string
  content: string
  positionX: number
  positionY: number
}

export default function BoardCanvas({ brandSpaceId, initialCards }: { brandSpaceId: string; initialCards: Card[] }) {
  const [cards, setCards] = useState(initialCards)
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  function handlePointerDown(e: React.PointerEvent, card: Card) {
    const rect = (e.target as HTMLElement).closest('[data-card]')?.getBoundingClientRect()
    if (!rect) return
    dragState.current = {
      id: card.id,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
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
        height: '65vh',
        minHeight: 420,
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--bg-card)',
      }}
      onPointerMove={(e) => handlePointerMove(e, e.currentTarget.getBoundingClientRect())}
      onPointerUp={handlePointerUp}
    >
      {cards.length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13.5 }}>
          Empty board — add a note, image link, or link below to get started.
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
            background: 'var(--bg-app)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            cursor: 'grab',
            userSelect: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setCards((prev) => prev.filter((c) => c.id !== card.id))
              deleteBoardCard(brandSpaceId, card.id)
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
            <div style={{ fontSize: 12.5, marginTop: 18, whiteSpace: 'pre-wrap' }}>{card.content}</div>
          )}
        </div>
      ))}
    </div>
  )
}
