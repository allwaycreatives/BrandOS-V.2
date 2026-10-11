// The maths of the board canvas, kept apart from the screen code so it can be tested on its own.
export type Rect = { x: number; y: number; w: number; h: number }
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// Drag a handle by (dx, dy). Edges on the left or top move the card's position as well as its size.
// widthOnly is for pictures, whose height always follows their width.
export function resizeRect(start: Rect, handle: Handle, dx: number, dy: number, min: { w: number; h: number }, max: number, widthOnly = false): Rect {
  let { x, y, w, h } = start
  const clamp = (v: number, lo: number) => Math.min(max, Math.max(lo, v))
  if (handle.includes('e')) w = clamp(start.w + dx, min.w)
  if (handle.includes('w')) {
    w = clamp(start.w - dx, min.w)
    x = start.x + (start.w - w)
  }
  if (!widthOnly) {
    if (handle.includes('s')) h = clamp(start.h + dy, min.h)
    if (handle.includes('n')) {
      h = clamp(start.h - dy, min.h)
      y = start.y + (start.h - h)
    }
  }
  return { x, y, w, h }
}

// What a press on a card does to the selection. Pressing inside a group keeps the group (so it can be dragged);
// whether to collapse to one card, or drop this one, is decided when the button is released without moving.
export function selectOnDown(current: Set<string>, id: string, additive: boolean) {
  const inSelection = current.has(id)
  if (additive) {
    if (inSelection) return { next: current, dragIds: Array.from(current), onUp: 'remove' as const }
    const next = new Set(current).add(id)
    return { next, dragIds: Array.from(next), onUp: null }
  }
  if (inSelection) return { next: current, dragIds: Array.from(current), onUp: current.size > 1 ? ('collapse' as const) : null }
  return { next: new Set([id]), dragIds: [id], onUp: null }
}

export const MOVE_THRESHOLD = 3 // pixels before a press counts as a drag
export const movedEnough = (dx: number, dy: number) => Math.hypot(dx, dy) > MOVE_THRESHOLD
