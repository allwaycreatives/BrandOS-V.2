'use client'

import { LINE_COLORS, arrowHead, resolveLine, type Box, type LineData, type Pt } from '@/lib/boardLines'

export type LineItem = { id: string; data: LineData }
export type DraftLine = { a: string | null; b: string | null; p1: [number, number]; p2: [number, number] }

const DEFAULT_COLOR = 'var(--text-secondary)'

// Draws every line and arrow on the board. It sits inside the zooming layer, so it moves and scales with the cards.
export default function LinesLayer({ lines, boxOf, selected, zoom, readOnly, draft, onSelect }: { lines: LineItem[]; boxOf: (id: string) => Box | undefined; selected: Set<string>; zoom: number; readOnly: boolean; draft: DraftLine | null; onSelect: (id: string, additive: boolean) => void }) {
  const pts = (p: Pt) => `${p.x},${p.y}`

  function drawLine(id: string, d: LineData) {
    const r = resolveLine(d, boxOf)
    const color = d.c ?? DEFAULT_COLOR
    const head = Math.min(26, 9 + d.w * 2.5)
    const isSel = selected.has(id)
    // Stop the stroke short of the arrowhead so its tip stays sharp.
    const len = Math.hypot(r.p2.x - r.p1.x, r.p2.y - r.p1.y)
    const unit = len > 0 ? { x: (r.p2.x - r.p1.x) / len, y: (r.p2.y - r.p1.y) / len } : { x: 0, y: 0 }
    const trim = head * 0.75
    const start = d.head === 'both' && len > trim * 2 ? { x: r.p1.x + unit.x * trim, y: r.p1.y + unit.y * trim } : r.p1
    const end = d.head !== 'none' && len > trim * 2 ? { x: r.p2.x - unit.x * trim, y: r.p2.y - unit.y * trim } : r.p2
    const d1 = `M ${pts(start)} L ${pts(end)}`
    return (
      <g key={id}>
        {isSel && <path d={d1} fill="none" strokeLinecap="round" style={{ stroke: 'var(--accent)', opacity: 0.35 }} strokeWidth={d.w + 7 / zoom} />}
        <path d={d1} fill="none" strokeLinecap="round" strokeWidth={d.w} strokeDasharray={d.dash ? `${d.w * 3} ${d.w * 2.4}` : undefined} style={{ stroke: color }} />
        {d.head !== 'none' && len > 2 && <polygon points={arrowHead(r.p2, r.p1, head).map(pts).join(' ')} style={{ fill: color }} />}
        {d.head === 'both' && len > 2 && <polygon points={arrowHead(r.p1, r.p2, head).map(pts).join(' ')} style={{ fill: color }} />}
        {/* a fat invisible copy so a thin line is easy to click */}
        <path
          d={`M ${pts(r.p1)} L ${pts(r.p2)}`}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(16 / zoom, d.w)}
          style={{ pointerEvents: readOnly ? 'none' : 'stroke', cursor: 'pointer' }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onSelect(id, e.shiftKey || e.ctrlKey || e.metaKey)
          }}
        />
        {isSel && !readOnly && (
          <>
            {(['a', 'b'] as const).map((end) => {
              const p = end === 'a' ? r.p1 : r.p2
              return <circle key={end} data-line-end={end} data-line-id={id} cx={p.x} cy={p.y} r={7 / zoom} strokeWidth={2 / zoom} style={{ fill: '#fff', stroke: 'var(--accent)', pointerEvents: 'all', cursor: 'grab' }} />
            })}
          </>
        )}
      </g>
    )
  }

  const preview = (() => {
    if (!draft) return null
    const r = resolveLine({ a: draft.a, b: draft.b, p1: draft.p1, p2: draft.p2, head: 'end', dash: false, c: null, w: 2 }, boxOf)
    return (
      <g style={{ pointerEvents: 'none' }}>
        <path d={`M ${pts(r.p1)} L ${pts(r.p2)}`} fill="none" strokeLinecap="round" strokeWidth={2.5} strokeDasharray="6 5" style={{ stroke: 'var(--accent)' }} />
        <polygon points={arrowHead(r.p2, r.p1, 12).map(pts).join(' ')} style={{ fill: 'var(--accent)' }} />
      </g>
    )
  })()

  return (
    <svg aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', pointerEvents: 'none', zIndex: 40 }}>
      {lines.map((l) => drawLine(l.id, l.data))}
      {preview}
    </svg>
  )
}

const chip: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--text-secondary)', padding: '4px 8px', minHeight: 0, fontSize: 12.5, borderRadius: 6, cursor: 'pointer', lineHeight: 1.2 }

// Floating options for the selected line: arrowheads, dashed, color, delete. Sits above the middle of the line.
export function LineToolbar({ line, boxOf, pan, zoom, onChange, onDelete }: { line: LineItem; boxOf: (id: string) => Box | undefined; pan: { x: number; y: number }; zoom: number; onChange: (patch: Partial<LineData>) => void; onDelete: () => void }) {
  const r = resolveLine(line.data, boxOf)
  const x = pan.x + ((r.p1.x + r.p2.x) / 2) * zoom
  const y = pan.y + ((r.p1.y + r.p2.y) / 2) * zoom
  const d = line.data
  const active = (on: boolean): React.CSSProperties => (on ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' } : {})
  return (
    <div
      data-nodrag
      role="toolbar"
      aria-label="Line options"
      style={{ position: 'absolute', left: Math.max(8, x), top: Math.max(8, y - 50), transform: 'translateX(-50%)', zIndex: 8, display: 'flex', alignItems: 'center', gap: 2, padding: 4, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}
    >
      <button type="button" title="Line, no arrows" onClick={() => onChange({ head: 'none' })} style={{ ...chip, ...active(d.head === 'none') }}>—</button>
      <button type="button" title="Arrow at the end" onClick={() => onChange({ head: 'end' })} style={{ ...chip, ...active(d.head === 'end') }}>→</button>
      <button type="button" title="Arrows at both ends" onClick={() => onChange({ head: 'both' })} style={{ ...chip, ...active(d.head === 'both') }}>↔</button>
      <span style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 3px' }} />
      <button type="button" title="Dashed line" onClick={() => onChange({ dash: !d.dash })} style={{ ...chip, ...active(d.dash) }}>┄ Dashed</button>
      <span style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 3px' }} />
      <button type="button" title="Thin" onClick={() => onChange({ w: 1.5 })} style={{ ...chip, ...active(d.w < 2) }}>Thin</button>
      <button type="button" title="Thick" onClick={() => onChange({ w: 4 })} style={{ ...chip, ...active(d.w >= 4) }}>Thick</button>
      <span style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 3px' }} />
      <button type="button" aria-label="Default color" title="Default color" onClick={() => onChange({ c: null })} style={{ width: 16, height: 16, minHeight: 0, padding: 0, margin: '0 2px', borderRadius: '50%', background: 'var(--text-secondary)', border: d.c === null ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }} />
      {LINE_COLORS.map((c) => (
        <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => onChange({ c })} style={{ width: 16, height: 16, minHeight: 0, padding: 0, margin: '0 2px', borderRadius: '50%', background: c, border: d.c === c ? '2px solid #fff' : '2px solid transparent', outline: d.c === c ? '1px solid var(--accent)' : 'none', cursor: 'pointer' }} />
      ))}
      <span style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 3px' }} />
      <button type="button" title="Delete this line" onClick={onDelete} style={{ ...chip, color: '#eb5757' }}>Delete</button>
    </div>
  )
}
