'use client'

import { useEffect, useRef, useState } from 'react'
import { CARD_COLORS, DEFAULT_FS, FONT_SIZES, TEXT_COLORS, type CardStyle } from '@/lib/boardStyle'
import { COLOR_TYPES, DEFAULT_COLOR, normalizeHex, type ColorCard } from '@/lib/boardColor'

// The bar that appears when cards are selected: text size, bold, italic, alignment, colours, title and subtitle, delete.
// For a colour card it becomes the colour editor. It floats beside the selection, and it can be dragged out of the way.
export default function BoardInspector({
  count,
  types,
  style,
  single,
  onStyle,
  onDelete,
  pos,
  manual,
  onMove,
  onReset,
  colorCard,
  onColor,
  autoFocusHex,
}: {
  count: number
  types: string[] // the kinds of card selected
  style: CardStyle // what the first selected card looks like
  single: { id: string; type: string } | null // set when exactly one card is selected
  onStyle: (patch: Record<string, unknown>) => void
  onDelete: () => void
  pos: { left: number; top: number; above: boolean } // where it floats by itself, relative to the canvas
  manual: { x: number; y: number } | null // where the person dragged it to (top-left corner), if they did
  onMove: (x: number, y: number) => void
  onReset: () => void
  colorCard: ColorCard | null // set when exactly one colour card is selected
  onColor: (patch: Partial<ColorCard>) => void
  autoFocusHex: boolean
}) {
  const [menu, setMenu] = useState<'text' | 'card' | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hexRef = useRef<HTMLInputElement>(null)
  const [hexDraft, setHexDraft] = useState(colorCard?.hex ?? '')

  // A colour changed from somewhere else (the colour picker): show it in the box. Typing is left alone.
  useEffect(() => {
    if (colorCard && normalizeHex(hexDraft) !== colorCard.hex) setHexDraft(colorCard.hex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorCard?.hex, single?.id])

  // A brand-new colour card asks for its colour straight away.
  useEffect(() => {
    if (autoFocusHex) {
      hexRef.current?.focus()
      hexRef.current?.select()
    }
  }, [autoFocusHex, single?.id])

  const textual = !colorCard && types.every((t) => t === 'note' || t === 'heading')
  const colourable = !colorCard && types.every((t) => ['note', 'heading', 'link', 'image'].includes(t))
  const defFs = DEFAULT_FS[types[0]] ?? 13
  const fs = style.fs ?? defFs
  const isBold = style.b ?? types[0] === 'heading'
  const idx = FONT_SIZES.findIndex((s) => s >= fs)
  const step = (dir: 1 | -1) => {
    const base = idx === -1 ? FONT_SIZES.length - 1 : idx
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, base + dir))]
    onStyle({ fs: next })
  }

  // Drag the bar by its handle. It stays inside the board, and stays where it was put until it is put back.
  function startDrag(e: React.PointerEvent) {
    const el = rootRef.current
    const parent = el?.parentElement
    if (!el || !parent) return
    e.preventDefault()
    const box = parent.getBoundingClientRect()
    const me = el.getBoundingClientRect()
    const origin = { x: me.left - box.left, y: me.top - box.top }
    const startX = e.clientX
    const startY = e.clientY
    const maxX = Math.max(0, box.width - me.width)
    const maxY = Math.max(0, box.height - me.height)
    const clamp = (v: number, hi: number) => Math.min(hi, Math.max(0, v))
    const move = (ev: PointerEvent) => onMove(clamp(origin.x + ev.clientX - startX, maxX), clamp(origin.y + ev.clientY - startY, maxY))
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    onMove(origin.x, origin.y) // from now on it stays where it is, wherever the card goes
  }

  const btn = (active = false): React.CSSProperties => ({
    minWidth: 30,
    height: 30,
    padding: '0 8px',
    fontSize: 13,
    borderRadius: 6,
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border-strong)'}`,
    background: active ? 'var(--accent-dim)' : 'transparent',
    color: active ? 'var(--accent-text)' : 'var(--text-primary)',
    cursor: 'pointer',
  })
  const sep = <span style={{ width: 1, height: 20, background: 'var(--border-strong)', margin: '0 2px' }} aria-hidden="true" />

  const swatches = (colors: string[], current: string | undefined, key: 'color' | 'bg') => (
    <div style={{ position: 'absolute', top: 38, left: 0, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', width: 196, zIndex: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {colors.map((c) => (
          <button key={c} type="button" aria-label={c} onClick={() => { onStyle({ [key]: c }); setMenu(null) }} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: current === c ? '2px solid var(--accent)' : '1px solid var(--border-strong)', padding: 0, cursor: 'pointer' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <label style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Any colour
          <input type="color" value={current ?? '#ffffff'} onChange={(e) => onStyle({ [key]: e.target.value })} style={{ width: 30, height: 24, padding: 0, border: 'none', background: 'transparent' }} />
        </label>
        <button type="button" onClick={() => { onStyle({ [key]: null }); setMenu(null) }} style={{ ...btn(), height: 26, fontSize: 11.5, marginLeft: 'auto' }}>Default</button>
      </div>
    </div>
  )

  const hexValid = normalizeHex(hexDraft) !== null
  const where: React.CSSProperties = manual
    ? { left: manual.x, top: manual.y, transform: 'none' }
    : { left: pos.left, top: pos.top, transform: pos.above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }

  return (
    <div
      ref={rootRef}
      data-nodrag
      // Pressing a button here must not pull the cursor out of the text being edited.
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input, select')) e.preventDefault() }}
      style={{ position: 'absolute', ...where, width: 'max-content', zIndex: 6, maxWidth: 'calc(100% - 16px)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
        <span
          data-grip
          role="button"
          aria-label="Move this bar"
          title="Drag to move this bar out of the way. Double-click to put it back."
          onPointerDown={startDrag}
          onDoubleClick={onReset}
          style={{ cursor: 'grab', padding: '0 6px', color: 'var(--text-muted)', userSelect: 'none', touchAction: 'none', letterSpacing: -2, fontSize: 15 }}
        >
          ⋮⋮
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 6px' }}>{count} selected</span>

        {colorCard && (
          <>
            {sep}
            <input type="color" value={colorCard.hex || DEFAULT_COLOR} onChange={(e) => onColor({ hex: e.target.value })} aria-label="Pick a colour" style={{ width: 34, height: 30, padding: 0, border: '1px solid var(--border-strong)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
            <input
              ref={hexRef}
              value={hexDraft}
              onChange={(e) => {
                setHexDraft(e.target.value)
                const n = normalizeHex(e.target.value)
                if (n) onColor({ hex: n })
              }}
              placeholder="#ff6929"
              aria-label="Colour code"
              aria-invalid={!hexValid}
              spellCheck={false}
              style={{ width: 96, fontSize: 13, borderColor: hexValid ? undefined : '#e5484d' }}
            />
            <button type="button" style={btn(colorCard.more)} aria-pressed={colorCard.more} onClick={() => onColor({ more: !colorCard.more })}>
              {colorCard.more ? 'Color only' : 'Add details'}
            </button>
          </>
        )}

        {textual && (
          <>
            {sep}
            <button type="button" style={btn()} onClick={() => step(-1)} aria-label="Smaller text">A−</button>
            <span style={{ fontSize: 12.5, minWidth: 26, textAlign: 'center' }} aria-label="Text size">{fs}</span>
            <button type="button" style={btn()} onClick={() => step(1)} aria-label="Bigger text">A+</button>
            <button type="button" style={{ ...btn(isBold), fontWeight: 700 }} onClick={() => onStyle({ b: !isBold })} aria-label="Bold" aria-pressed={isBold}>B</button>
            <button type="button" style={{ ...btn(!!style.i), fontStyle: 'italic' }} onClick={() => onStyle({ i: !style.i })} aria-label="Italic" aria-pressed={!!style.i}>I</button>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} type="button" style={btn((style.al ?? 'left') === a)} onClick={() => onStyle({ al: a })} aria-label={`Align ${a}`} aria-pressed={(style.al ?? 'left') === a}>{a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}</button>
            ))}
            <span style={{ position: 'relative' }}>
              <button type="button" style={btn(menu === 'text')} onClick={() => setMenu(menu === 'text' ? null : 'text')} aria-label="Text colour">
                <span style={{ borderBottom: `3px solid ${style.color ?? '#1a1a1a'}`, fontWeight: 600 }}>A</span>
              </button>
              {menu === 'text' && swatches(TEXT_COLORS, style.color, 'color')}
            </span>
          </>
        )}

        {colourable && (
          <>
            {sep}
            <span style={{ position: 'relative' }}>
              <button type="button" style={btn(menu === 'card')} onClick={() => setMenu(menu === 'card' ? null : 'card')} aria-label="Card colour">
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 3, background: style.bg ?? '#ffffff', border: '1px solid var(--border-strong)', verticalAlign: -2, marginRight: 6 }} />
                Card
              </button>
              {menu === 'card' && swatches(CARD_COLORS, style.bg, 'bg')}
            </span>
          </>
        )}

        {sep}
        <button type="button" style={{ ...btn(), color: 'var(--accent-text)' }} onClick={onDelete}>Delete{count > 1 ? ` ${count}` : ''}</button>
      </div>

      {colorCard?.more && (
        <div key={single?.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input value={colorCard.name} onChange={(e) => onColor({ name: e.target.value })} placeholder="Name, like Sunset Orange" aria-label="Color name" style={{ flex: '1 1 150px', fontSize: 12.5 }} />
          <select value={colorCard.type} onChange={(e) => onColor({ type: e.target.value })} aria-label="Color type" style={{ flex: '0 1 130px', fontSize: 12.5 }}>
            <option value="">Type</option>
            {COLOR_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input value={colorCard.use} onChange={(e) => onColor({ use: e.target.value })} placeholder="What it is used for" aria-label="Used for" style={{ flex: '1 1 170px', fontSize: 12.5 }} />
        </div>
      )}

      {single && (single.type === 'note' || single.type === 'heading') && (
        <div key={single.id} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {single.type === 'note' && (
            <input defaultValue={style.title ?? ''} placeholder="Title (optional)" aria-label="Title" onBlur={(e) => e.target.value.trim() !== (style.title ?? '') && onStyle({ title: e.target.value.trim() || null })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} style={{ flex: '1 1 160px', fontSize: 12.5 }} />
          )}
          <input defaultValue={style.subtitle ?? ''} placeholder="Subtitle (optional)" aria-label="Subtitle" onBlur={(e) => e.target.value.trim() !== (style.subtitle ?? '') && onStyle({ subtitle: e.target.value.trim() || null })} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} style={{ flex: '1 1 160px', fontSize: 12.5 }} />
        </div>
      )}
    </div>
  )
}
