'use client'

import { useEffect, useRef, useState } from 'react'
import { readableText } from '@/lib/boardStyle'

// Stored as "hex|role|use|name". Older cards only have the first three, which still read fine.
export function parseColorContent(content: string) {
  const [hex = '#888888', role = '', use = '', name = ''] = content.split('|')
  return { hex, role, use, name }
}

export function normalizeHex(raw: string): string | null {
  let v = raw.trim()
  if (!v.startsWith('#')) v = `#${v}`
  if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null
}

const clean = (s: string) => s.replace(/\|/g, '').replace(/\s*\n\s*/g, ' ')
const serialize = (c: { hex: string; role: string; use: string; name: string }) => [c.hex, clean(c.role), clean(c.use), clean(c.name)].join('|').replace(/\|+$/, '')

export const COLOR_PALETTE = ['#ff6929', '#4ec9e4', '#f2c94c', '#6fcf97', '#bb6bd9', '#eb5757', '#2f80ed', '#1a1a1a']

const bare: React.CSSProperties = { border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, margin: 0, minHeight: 0, borderRadius: 0, width: '100%', fontFamily: 'inherit' }

// A Milanote-style color card: a big swatch with the hex on it, and a name underneath.
// Role ("Primary", "Background") and "used for" are optional extras you can add, never required.
export default function ColorCard({ content, readOnly, selected, autoFocus, onChange }: { content: string; readOnly: boolean; selected: boolean; autoFocus?: boolean; onChange: (text: string) => void }) {
  const start = useRef(parseColorContent(content)).current
  const [hex, setHex] = useState(normalizeHex(start.hex) ?? '#888888')
  const [hexText, setHexText] = useState((normalizeHex(start.hex) ?? '#888888').toUpperCase())
  const [name, setName] = useState(start.name)
  const [role, setRole] = useState(start.role)
  const [use, setUse] = useState(start.use)
  const [showRole, setShowRole] = useState(!!start.role)
  const [showUse, setShowUse] = useState(!!start.use)
  const [active, setActive] = useState(false)
  const hexInput = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const latest = useRef({ hex, role, use, name })
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => {
    if (autoFocus && !readOnly) {
      hexInput.current?.focus()
      hexInput.current?.select()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(serialize(latest.current))
  }, [])

  function update(patch: Partial<{ hex: string; role: string; use: string; name: string }>) {
    const next = { ...latest.current, ...patch }
    latest.current = next
    if (patch.hex !== undefined) setHex(patch.hex)
    if (patch.role !== undefined) setRole(patch.role)
    if (patch.use !== undefined) setUse(patch.use)
    if (patch.name !== undefined) setName(patch.name)
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      send.current(serialize(next))
    }, 500)
  }

  const ink = readableText(hex)
  const showRoleRow = showRole || !!role
  const showUseRow = showUse || !!use
  const canAdd = !readOnly && (selected || active)

  return (
    <div
      onFocus={() => setActive(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setActive(false) }}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, color: '#1a1a1a' }}
    >
      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 96, background: hex, padding: '10px 12px', color: ink }}>
        <input
          ref={hexInput}
          value={hexText}
          readOnly={readOnly}
          aria-label="Color code"
          spellCheck={false}
          maxLength={7}
          onChange={(e) => {
            setHexText(e.target.value)
            const n = normalizeHex(e.target.value)
            if (n) update({ hex: n })
          }}
          onBlur={() => setHexText(hex.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
          }}
          style={{ ...bare, fontSize: 13, fontWeight: 600, letterSpacing: 0.3, color: ink, width: 'calc(100% - 26px)' }}
        />
        {!readOnly && (
          <>
            <button
              type="button"
              aria-label="Pick a color"
              title="Pick a color"
              onClick={() => picker.current?.click()}
              style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, minHeight: 0, padding: 0, borderRadius: '50%', border: `2px solid ${ink}`, background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', cursor: 'pointer' }}
            />
            <input
              ref={picker}
              type="color"
              value={hex}
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                setHexText(e.target.value.toUpperCase())
                update({ hex: e.target.value.toLowerCase() })
              }}
              style={{ position: 'absolute', top: 8, right: 8, width: 1, height: 1, opacity: 0, pointerEvents: 'none', padding: 0, border: 'none' }}
            />
          </>
        )}
      </div>

      <div style={{ padding: '8px 12px 10px', display: 'flex', flexDirection: 'column', gap: 4, background: '#fff' }}>
        {(!readOnly || name) && (
          <input
            value={name}
            readOnly={readOnly}
            placeholder="Name this color"
            aria-label="Color name"
            onChange={(e) => update({ name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            style={{ ...bare, fontSize: 12.5, fontWeight: 600 }}
          />
        )}
        {showRoleRow && (
          <input
            value={role}
            readOnly={readOnly}
            placeholder="Role (Primary, Background…)"
            aria-label="Color role"
            onChange={(e) => update({ role: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            style={{ ...bare, fontSize: 11.5, color: '#555' }}
          />
        )}
        {showUseRow && (
          <input
            value={use}
            readOnly={readOnly}
            placeholder="Used for…"
            aria-label="What this color is used for"
            onChange={(e) => update({ use: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
            style={{ ...bare, fontSize: 11.5, color: '#777' }}
          />
        )}
        {canAdd && (!showRoleRow || !showUseRow) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
            {!showRoleRow && <button type="button" onClick={() => setShowRole(true)} style={{ ...bare, width: 'auto', fontSize: 11, color: '#999', cursor: 'pointer' }}>+ Role</button>}
            {!showUseRow && <button type="button" onClick={() => setShowUse(true)} style={{ ...bare, width: 'auto', fontSize: 11, color: '#999', cursor: 'pointer' }}>+ Used for</button>}
          </div>
        )}
      </div>
    </div>
  )
}
