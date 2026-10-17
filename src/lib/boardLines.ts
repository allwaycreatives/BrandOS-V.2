// Lines and arrows between cards. A line is stored as a card of type "line" whose text is the JSON below.
// This file is only maths, so it can be tested on its own.

export type Pt = { x: number; y: number }
export type Box = { x: number; y: number; w: number; h: number }
export type HeadStyle = 'end' | 'both' | 'none'

export type LineData = {
  a: string | null // card the start is attached to (null = loose end)
  b: string | null // card the end is attached to
  p1: [number, number] // where each end was last drawn. Loose ends use these; attached ends use them only
  p2: [number, number] // as a fallback, e.g. in a copy of the board where the cards got new ids.
  head: HeadStyle
  dash: boolean
  c: string | null // color (#rrggbb) or null for the default
  w: number // thickness
}

const HEX = /^#[0-9a-f]{6}$/i
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const pair = (v: unknown, d: [number, number]): [number, number] => (Array.isArray(v) ? [num(v[0], d[0]), num(v[1], d[1])] : d)

export function parseLine(content: string): LineData | null {
  try {
    const d = JSON.parse(content)
    if (!d || typeof d !== 'object') return null
    return {
      a: typeof d.a === 'string' && d.a ? d.a : null,
      b: typeof d.b === 'string' && d.b ? d.b : null,
      p1: pair(d.p1, [0, 0]),
      p2: pair(d.p2, [120, 0]),
      head: d.head === 'both' || d.head === 'none' ? d.head : 'end',
      dash: d.dash === true,
      c: typeof d.c === 'string' && HEX.test(d.c) ? d.c.toLowerCase() : null,
      w: Math.min(8, Math.max(1, num(d.w, 2))),
    }
  } catch {
    return null
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10
export const serializeLine = (l: LineData) => JSON.stringify({ ...l, p1: [r1(l.p1[0]), r1(l.p1[1])], p2: [r1(l.p2[0]), r1(l.p2[1])] })

export const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

// The point where a line from the middle of a card toward `toward` leaves the card, pushed out a little (the gap).
export function edgePoint(box: Box, toward: Pt, gap = 5): Pt {
  const c = center(box)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return c
  const sx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx)
  const sy = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy)
  const s = Math.min(sx, sy)
  if (s >= 1) return c // the target is inside the card: nothing to draw
  return { x: c.x + dx * s + (dx / len) * gap, y: c.y + dy * s + (dy / len) * gap }
}

// Where the two ends actually are right now. Attached ends hug their card; loose ends stay where they were put.
export function resolveLine(l: LineData, boxOf: (id: string) => Box | undefined): { p1: Pt; p2: Pt; a: Box | undefined; b: Box | undefined } {
  const a = l.a ? boxOf(l.a) : undefined
  const b = l.b ? boxOf(l.b) : undefined
  const loose1: Pt = { x: l.p1[0], y: l.p1[1] }
  const loose2: Pt = { x: l.p2[0], y: l.p2[1] }
  const aim1 = b ? center(b) : loose2
  const aim2 = a ? center(a) : loose1
  return { p1: a ? edgePoint(a, aim1) : loose1, p2: b ? edgePoint(b, aim2) : loose2, a, b }
}

// A filled triangle with its tip at `tip`, pointing away from `from`.
export function arrowHead(tip: Pt, from: Pt, size: number): [Pt, Pt, Pt] {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x)
  const spread = Math.PI / 7
  return [tip, { x: tip.x - size * Math.cos(ang - spread), y: tip.y - size * Math.sin(ang - spread) }, { x: tip.x - size * Math.cos(ang + spread), y: tip.y - size * Math.sin(ang + spread) }]
}

// How far a point is from a box (0 when it is inside).
export function distanceToBox(p: Pt, b: Box): number {
  const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w))
  const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h))
  return Math.hypot(dx, dy)
}

// When a board is copied, its cards get new ids and the lines would lose their cards.
// This hooks each loose-looking end back onto the card it was touching, or lets it go if there is none.
export function healLine(l: LineData, boxes: { id: string; box: Box }[], known: Set<string>, tolerance = 28): LineData {
  const nearest = (p: [number, number]) => {
    let best: { id: string; d: number } | null = null
    for (const { id, box } of boxes) {
      const d = distanceToBox({ x: p[0], y: p[1] }, box)
      if (d <= tolerance && (!best || d < best.d)) best = { id, d }
    }
    return best?.id ?? null
  }
  return {
    ...l,
    a: l.a && !known.has(l.a) ? nearest(l.p1) : l.a,
    b: l.b && !known.has(l.b) ? nearest(l.p2) : l.b,
  }
}

export function pointOnSegmentDistance(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const len2 = vx * vx + vy * vy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2))
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy))
}

export const LINE_COLORS = ['#ff6929', '#4ec9e4', '#f2c94c', '#6fcf97', '#bb6bd9', '#eb5757']
