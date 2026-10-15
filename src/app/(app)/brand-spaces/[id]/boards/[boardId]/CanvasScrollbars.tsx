'use client'

import { useRef } from 'react'

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number }
type Axis = 'x' | 'y'

const TRACK = 10 // thickness in px
const EDGE = 3
const CORNER = 16 // keeps the two bars from touching

// Where the thumb sits and how long it is, for one direction. Pure maths, so it can be tested on its own.
export function axisGeometry(contentMin: number, contentMax: number, panAxis: number, zoom: number, size: number) {
  const visMin = -panAxis / zoom
  const visSpan = size / zoom
  const margin = visSpan * 0.5 // a little room to scroll past the last card
  const totalMin = Math.min(visMin, contentMin - margin)
  const totalMax = Math.max(visMin + visSpan, contentMax + margin)
  const totalSpan = totalMax - totalMin
  const trackLen = size - CORNER - EDGE * 2
  const thumbLen = Math.max(36, Math.min(trackLen, (visSpan / totalSpan) * trackLen))
  const room = Math.max(1, trackLen - thumbLen)
  const scrollable = Math.max(1e-6, totalSpan - visSpan)
  const thumbPos = Math.min(room, Math.max(0, ((visMin - totalMin) / scrollable) * room))
  return { visMin, visSpan, totalMin, totalSpan, thumbLen, thumbPos, room, scrollable }
}

// Scrollbars for the board, like Milanote: they live inside the board and move the board, never the page.
export default function CanvasScrollbars({ bounds, pan, zoom, view, onPan }: { bounds: Bounds | null; pan: { x: number; y: number }; zoom: number; view: { w: number; h: number }; onPan: (p: { x: number; y: number }) => void }) {
  const drag = useRef<{ axis: Axis; startPointer: number; startVis: number; totalMin: number; totalSpan: number; visSpan: number; room: number } | null>(null)
  if (!bounds || view.w < 80 || view.h < 80) return null

  function geometry(axis: Axis) {
    const b = bounds as Bounds
    return axisGeometry(axis === 'x' ? b.minX : b.minY, axis === 'x' ? b.maxX : b.maxY, axis === 'x' ? pan.x : pan.y, zoom, axis === 'x' ? view.w : view.h)
  }

  function begin(axis: Axis, e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    const g = geometry(axis)
    drag.current = { axis, startPointer: axis === 'x' ? e.clientX : e.clientY, startVis: g.visMin, totalMin: g.totalMin, totalSpan: g.totalSpan, visSpan: g.visSpan, room: g.room }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function move(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    const delta = (d.axis === 'x' ? e.clientX : e.clientY) - d.startPointer
    const scrollable = Math.max(1e-6, d.totalSpan - d.visSpan)
    const nextVis = Math.min(d.totalMin + scrollable, Math.max(d.totalMin, d.startVis + (delta / d.room) * scrollable))
    onPan(d.axis === 'x' ? { x: -nextVis * zoom, y: pan.y } : { x: pan.x, y: -nextVis * zoom })
  }

  const end = () => {
    drag.current = null
  }

  const thumb = (axis: Axis) => {
    const g = geometry(axis)
    const common: React.CSSProperties = { position: 'absolute', borderRadius: TRACK, background: 'color-mix(in srgb, var(--text-muted) 45%, transparent)', cursor: 'pointer', touchAction: 'none' }
    return axis === 'x'
      ? <div className="canvas-thumb" data-nodrag onPointerDown={(e) => begin('x', e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ ...common, left: EDGE + g.thumbPos, width: g.thumbLen, height: TRACK, bottom: EDGE }} />
      : <div className="canvas-thumb" data-nodrag onPointerDown={(e) => begin('y', e)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ ...common, top: EDGE + g.thumbPos, height: g.thumbLen, width: TRACK, right: EDGE }} />
  }

  return (
    <div aria-hidden="true" data-nodrag style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      <div style={{ pointerEvents: 'auto' }}>{thumb('x')}</div>
      <div style={{ pointerEvents: 'auto' }}>{thumb('y')}</div>
    </div>
  )
}
