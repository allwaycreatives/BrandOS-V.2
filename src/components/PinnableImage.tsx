'use client'

import { useRef } from 'react'

export type Pin = { id: string; n: number; x: number; y: number; resolved: boolean }

// An image proof you can click to pin a comment to an exact spot. Pins are numbered and
// match the numbered comments below. Without onPlace it is view-only (the team's view).
export default function PinnableImage({
  src,
  pins,
  pending,
  onPlace,
}: {
  src: string
  pins: Pin[]
  pending?: { x: number; y: number } | null
  onPlace?: (p: { x: number; y: number }) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  function place(e: React.MouseEvent) {
    if (!onPlace || !ref.current) return
    if ((e.target as HTMLElement).closest('[data-pin]')) return
    const r = ref.current.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
    onPlace({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
  }

  return (
    <div ref={ref} onClick={place} style={{ position: 'relative', lineHeight: 0, cursor: onPlace ? 'crosshair' : 'default' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
      {pins.map((p) => (
        <button
          key={p.id}
          type="button"
          data-pin
          aria-label={`Pin ${p.n}`}
          onClick={(e) => {
            e.stopPropagation()
            document.getElementById(`fb-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }}
          style={{
            position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)',
            width: 26, height: 26, minHeight: 0, padding: 0, borderRadius: '50%',
            fontSize: 12, fontWeight: 700, lineHeight: '22px', textAlign: 'center',
            background: p.resolved ? '#555' : 'var(--accent)', color: p.resolved ? '#ddd' : '#000',
            border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.5)', cursor: 'pointer',
          }}
        >
          {p.n}
        </button>
      ))}
      {pending && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', left: `${pending.x}%`, top: `${pending.y}%`, transform: 'translate(-50%, -50%)',
            width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--accent)',
            background: 'rgba(0,0,0,0.35)', pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
