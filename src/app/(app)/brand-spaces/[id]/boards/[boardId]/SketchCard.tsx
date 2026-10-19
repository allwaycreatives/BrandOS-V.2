'use client'

import { useEffect, useRef, useState } from 'react'

type Stroke = { c: string; w: number; p: [number, number][] }
type Sketch = { w: number; h: number; strokes: Stroke[] }

const W = 260
const H = 180
const MAX_BYTES = 48000 // the database keeps up to 50,000 characters for a sketch
const INKS = ['#1a1a1a', '#ff6929', '#2f80ed', '#27ae60', '#eb5757']
const SIZES = [2.2, 5]

export function parseSketch(content: string): Sketch {
  try {
    const d = JSON.parse(content)
    const strokes: Stroke[] = Array.isArray(d?.strokes)
      ? d.strokes
          .filter((s: Stroke) => s && Array.isArray(s.p) && s.p.length > 0)
          .map((s: Stroke) => ({ c: typeof s.c === 'string' ? s.c : '#1a1a1a', w: typeof s.w === 'number' ? s.w : 2.2, p: s.p.map((q) => [Number(q[0]) || 0, Number(q[1]) || 0] as [number, number]) }))
      : []
    return { w: Number(d?.w) > 0 ? Number(d.w) : W, h: Number(d?.h) > 0 ? Number(d.h) : H, strokes }
  } catch {
    return { w: W, h: H, strokes: [] }
  }
}
export const serializeSketch = (s: Sketch) => JSON.stringify(s)

const small: React.CSSProperties = { border: 'none', background: 'transparent', padding: '2px 6px', minHeight: 0, fontSize: 11.5, color: '#666', cursor: 'pointer', borderRadius: 4 }

// A tiny drawing pad. Double-click a sketch to draw on it; it scales with the card like a picture.
export const DRAWING_INKS = ['#ff6929', '#ffffff', '#4ec9e4', '#f2c94c', '#6fcf97', '#eb5757', '#1a1a1a']

export default function SketchCard({ content, editing, readOnly, transparent = false, onChange, onDone }: { content: string; editing: boolean; readOnly: boolean; transparent?: boolean; onChange: (text: string) => void; onDone: () => void }) {
  const [sketch, setSketch] = useState<Sketch>(() => parseSketch(content))
  const palette = transparent ? DRAWING_INKS : INKS
  const [ink, setInk] = useState(palette[0])
  const [size, setSize] = useState(SIZES[0])
  const [live, setLive] = useState<Stroke | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const liveRef = useRef<Stroke | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const dirty = useRef(false)
  const latest = useRef(sketch)
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(serializeSketch(latest.current))
  }, [])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onDone])

  function save(next: Sketch) {
    if (serializeSketch(next).length > MAX_BYTES) return // the sketch is full
    setSketch(next)
    latest.current = next
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      send.current(serializeSketch(next))
    }, 500)
  }

  function point(e: React.PointerEvent): [number, number] {
    const r = (svg.current as SVGSVGElement).getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / r.width) * sketch.w * 10) / 10, Math.round(((e.clientY - r.top) / r.height) * sketch.h * 10) / 10]
  }

  function down(e: React.PointerEvent) {
    if (!editing || readOnly || e.button > 0) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    liveRef.current = { c: ink, w: size, p: [point(e)] }
    setLive(liveRef.current)
  }
  function move(e: React.PointerEvent) {
    const s = liveRef.current
    if (!s) return
    const [x, y] = point(e)
    const last = s.p[s.p.length - 1]
    if (Math.hypot(x - last[0], y - last[1]) < 1.2 || s.p.length > 2500) return
    liveRef.current = { ...s, p: [...s.p, [x, y]] }
    setLive(liveRef.current)
  }
  function up() {
    const s = liveRef.current
    liveRef.current = null
    setLive(null)
    if (s) save({ ...sketch, strokes: [...sketch.strokes, s] })
  }

  const draw = (s: Stroke, key: string | number) =>
    s.p.length === 1 ? (
      <circle key={key} cx={s.p[0][0]} cy={s.p[0][1]} r={s.w / 2} fill={s.c} />
    ) : (
      <polyline key={key} points={s.p.map((q) => q.join(',')).join(' ')} fill="none" stroke={s.c} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
    )

  const empty = sketch.strokes.length === 0 && !live
  return (
    <div style={{ color: '#1a1a1a' }}>
      <div style={{ position: 'relative' }}>
        <svg
          ref={svg}
          viewBox={`0 0 ${sketch.w} ${sketch.h}`}
          data-nodrag={editing ? '' : undefined}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ display: 'block', width: '100%', height: 'auto', touchAction: editing ? 'none' : undefined, cursor: editing ? 'crosshair' : 'inherit', background: transparent ? 'transparent' : '#fff', borderRadius: transparent ? 0 : 3, outline: transparent && editing ? '1px dashed rgba(150,150,150,0.7)' : undefined }}
        >
          {sketch.strokes.map((s, i) => draw(s, i))}
          {live && draw(live, 'live')}
        </svg>
        {empty && !editing && !transparent && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#b0b0b0', pointerEvents: 'none' }}>{readOnly ? 'Empty sketch' : 'Double-click to sketch'}</div>
        )}
      </div>
      {editing && !readOnly && (
        <div data-nodrag style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8, ...(transparent ? { padding: '6px 8px', background: '#fff', borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' } : {}) }}>
          {palette.map((c) => (
            <button key={c} type="button" aria-label={`Ink ${c}`} onClick={() => setInk(c)} style={{ width: 16, height: 16, minHeight: 0, padding: 0, borderRadius: '50%', background: c, border: ink === c ? '2px solid #888' : '2px solid transparent', outline: ink === c ? '1px solid #fff' : 'none', cursor: 'pointer' }} />
          ))}
          <span style={{ width: 1, height: 14, background: '#ddd', margin: '0 2px' }} />
          {SIZES.map((s) => (
            <button key={s} type="button" aria-label={s > 3 ? 'Thick pen' : 'Thin pen'} onClick={() => setSize(s)} style={{ ...small, background: size === s ? '#eee' : 'transparent' }}>{s > 3 ? 'Thick' : 'Thin'}</button>
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" onClick={() => save({ ...sketch, strokes: sketch.strokes.slice(0, -1) })} disabled={sketch.strokes.length === 0} style={{ ...small, opacity: sketch.strokes.length ? 1 : 0.4 }}>Undo</button>
          <button type="button" onClick={() => save({ ...sketch, strokes: [] })} disabled={sketch.strokes.length === 0} style={{ ...small, opacity: sketch.strokes.length ? 1 : 0.4 }}>Clear</button>
          <button type="button" onClick={onDone} style={{ ...small, background: '#1a1a1a', color: '#fff', padding: '3px 10px' }}>Done</button>
        </div>
      )}
    </div>
  )
}
