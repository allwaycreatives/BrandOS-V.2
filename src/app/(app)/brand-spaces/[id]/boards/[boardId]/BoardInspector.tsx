'use client'

import { useState } from 'react'
import { CARD_COLORS, DEFAULT_FS, FONT_SIZES, TEXT_COLORS, type CardStyle } from '@/lib/boardStyle'

// The bar that appears when cards are selected: text size, bold, italic, alignment, colours, title and subtitle, delete.
export default function BoardInspector({
  count,
  types,
  style,
  single,
  onStyle,
  onDelete,
}: {
  count: number
  types: string[] // the kinds of card selected
  style: CardStyle // what the first selected card looks like
  single: { id: string; type: string } | null // set when exactly one card is selected
  onStyle: (patch: Record<string, unknown>) => void
  onDelete: () => void
}) {
  const [menu, setMenu] = useState<'text' | 'card' | null>(null)
  const textual = types.every((t) => t === 'note' || t === 'heading')
  const colourable = types.every((t) => ['note', 'heading', 'link', 'image'].includes(t))
  const defFs = DEFAULT_FS[types[0]] ?? 13
  const fs = style.fs ?? defFs
  const isBold = style.b ?? types[0] === 'heading'
  const idx = FONT_SIZES.findIndex((s) => s >= fs)
  const step = (dir: 1 | -1) => {
    const base = idx === -1 ? FONT_SIZES.length - 1 : idx
    const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, base + dir))]
    onStyle({ fs: next })
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
    <div style={{ position: 'absolute', bottom: 40, left: 0, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', width: 196, zIndex: 8 }}>
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

  return (
    <div data-nodrag style={{ position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', zIndex: 6, maxWidth: 'calc(100% - 24px)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '0 6px' }}>{count} selected</span>

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
