// Turns scribbles drawn on the board into the content of one drawing card.
// Points are saved relative to the drawing's own corner, so the card can be moved and resized like a picture.

export type RawStroke = { c: string; w: number; p: [number, number][] }
export type BuiltDrawing = { content: string; w: number; h: number; x: number; y: number }

const r1 = (n: number) => Math.round(n * 10) / 10
export const MAX_DRAWING_CHARS = 48000

export function buildDrawing(strokes: RawStroke[], pad = 10): BuiltDrawing {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes) {
    for (const [x, y] of s.p) {
      minX = Math.min(minX, x - s.w)
      minY = Math.min(minY, y - s.w)
      maxX = Math.max(maxX, x + s.w)
      maxY = Math.max(maxY, y + s.w)
    }
  }
  const w = Math.max(24, Math.ceil(maxX - minX + pad * 2))
  const h = Math.max(24, Math.ceil(maxY - minY + pad * 2))
  const content = JSON.stringify({
    w,
    h,
    strokes: strokes.map((s) => ({ c: s.c, w: r1(s.w), p: s.p.map(([x, y]) => [r1(x - minX + pad), r1(y - minY + pad)]) })),
  })
  return { content, w, h, x: minX - pad, y: minY - pad }
}

// A very busy drawing is thinned out (every other point, keeping each stroke's ends) until it fits. Returns null if it never can.
export function fitDrawing(strokes: RawStroke[], pad = 10): BuiltDrawing | null {
  let list = strokes
  let built = buildDrawing(list, pad)
  for (let i = 0; i < 5 && built.content.length > MAX_DRAWING_CHARS; i++) {
    list = list.map((s) => ({ ...s, p: s.p.filter((_, k) => k % 2 === 0 || k === s.p.length - 1) }))
    built = buildDrawing(list, pad)
  }
  return built.content.length > MAX_DRAWING_CHARS ? null : built
}
