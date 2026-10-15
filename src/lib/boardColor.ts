// A colour card: the colour itself, and (only if you want them) a name, a type and what it is used for.
export type ColorCard = { hex: string; name: string; type: string; use: string; more: boolean }

export const COLOR_TYPES = ['Primary', 'Secondary', 'Accent', 'Neutral', 'Background', 'Text', 'Other']
export const DEFAULT_COLOR = '#ff6929'

// "#abc", "abc", "#AABBCC" and "aabbcc" all work. Anything else is not a colour code.
export function normalizeHex(input: string): string | null {
  const t = String(input ?? '').trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(t)) return `#${t.split('').map((c) => c + c).join('').toLowerCase()}`
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toLowerCase()}`
  return null
}

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

// Reads a colour card's saved text. New cards are saved as JSON. Older cards were saved as "#hex|name|use".
export function parseColorCard(content: string): ColorCard {
  const text = String(content ?? '')
  if (text.trim().startsWith('{')) {
    try {
      const o = JSON.parse(text) as Record<string, unknown>
      const hex = normalizeHex(String(o.hex ?? '')) ?? ''
      const type = clip(o.type, 40)
      return { hex, name: clip(o.name, 80), type: COLOR_TYPES.includes(type) ? type : '', use: clip(o.use, 300), more: o.more === true }
    } catch {
      // fall through to an empty card
    }
    return { hex: '', name: '', type: '', use: '', more: false }
  }
  const [rawHex = '', role = '', use = ''] = text.split('|')
  const asType = COLOR_TYPES.find((t) => t.toLowerCase() === role.trim().toLowerCase())
  const card = { hex: normalizeHex(rawHex) ?? '', name: asType ? '' : clip(role, 80), type: asType ?? '', use: clip(use, 300), more: false }
  return { ...card, more: !!(card.name || card.type || card.use) } // older cards had details, so they keep showing them
}

export function serializeColorCard(c: Partial<ColorCard>): string {
  const hex = normalizeHex(c.hex ?? '') ?? ''
  const type = clip(c.type, 40)
  return JSON.stringify({ hex, name: clip(c.name, 80), type: COLOR_TYPES.includes(type) ? type : '', use: clip(c.use, 300), more: c.more === true })
}
