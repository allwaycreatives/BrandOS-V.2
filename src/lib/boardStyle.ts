// How a board card can look. Stored on the card as a small JSON string, and always cleaned before it is saved or used.
export type CardStyle = {
  fs?: number // text size in pixels
  b?: boolean // bold
  i?: boolean // italic
  al?: 'left' | 'center' | 'right'
  color?: string // text colour, #rrggbb
  bg?: string // card colour, #rrggbb
  title?: string
  subtitle?: string
}

export const CARD_COLORS = ['#ffffff', '#fff8e1', '#fff3a3', '#ffd9c2', '#ffd1dc', '#e4d9ff', '#cfe8ff', '#d3f5e1', '#e9e9e9', '#1f1f1f']
export const TEXT_COLORS = ['#1a1a1a', '#555555', '#b91c1c', '#c2410c', '#a16207', '#15803d', '#0369a1', '#6d28d9', '#be185d', '#ffffff']
export const FONT_SIZES = [11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64]
export const DEFAULT_FS: Record<string, number> = { note: 13, heading: 22, link: 13 }

// The smallest a card can be made, per kind.
export const MIN_SIZE: Record<string, { w: number; h: number }> = {
  note: { w: 90, h: 44 },
  heading: { w: 90, h: 34 },
  image: { w: 60, h: 40 },
  link: { w: 150, h: 80 },
  color: { w: 120, h: 110 },
  board: { w: 150, h: 96 },
}
export const MAX_CARD_SIZE = 2000

const HEX = /^#[0-9a-f]{6}$/i
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

export function sanitizeStyle(raw: unknown): CardStyle {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: CardStyle = {}
  if (typeof o.fs === 'number' && Number.isFinite(o.fs)) out.fs = Math.round(Math.min(96, Math.max(9, o.fs)))
  if (typeof o.b === 'boolean') out.b = o.b // true or false are both real choices (a title can be un-bolded)
  if (typeof o.i === 'boolean') out.i = o.i
  if (o.al === 'left' || o.al === 'center' || o.al === 'right') out.al = o.al
  if (typeof o.color === 'string' && HEX.test(o.color)) out.color = o.color.toLowerCase()
  if (typeof o.bg === 'string' && HEX.test(o.bg)) out.bg = o.bg.toLowerCase()
  const title = clip(o.title, 200)
  if (title) out.title = title
  const subtitle = clip(o.subtitle, 200)
  if (subtitle) out.subtitle = subtitle
  return out
}

export function parseStyle(raw: string | null | undefined): CardStyle {
  if (!raw) return {}
  try {
    return sanitizeStyle(JSON.parse(raw))
  } catch {
    return {}
  }
}

// A patch value of null removes that choice (back to the default).
export function mergeStyle(current: CardStyle, patch: Record<string, unknown>): CardStyle {
  const next: Record<string, unknown> = { ...current }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') delete next[k]
    else next[k] = v
  }
  return sanitizeStyle(next)
}

export const styleToJson = (s: CardStyle) => (Object.keys(s).length ? JSON.stringify(s) : null)

// Dark card colours get light text, light ones get dark text, unless a text colour was chosen on purpose.
export function readableText(bg: string): string {
  if (!HEX.test(bg)) return '#1a1a1a'
  const n = parseInt(bg.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b < 140 ? '#ffffff' : '#1a1a1a'
}
