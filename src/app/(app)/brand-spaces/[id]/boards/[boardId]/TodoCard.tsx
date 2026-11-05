'use client'

import { useEffect, useRef, useState } from 'react'

type Item = { done: boolean; text: string }

// Stored as plain text so it needs no database change: an optional title line, then one "[ ] task" / "[x] task" per line.
const ITEM = /^\[( |x)\] ?(.*)$/

export function parseTodo(content: string): { title: string; items: Item[] } {
  const lines = content.split('\n')
  let title = ''
  if (lines.length > 0 && !ITEM.test(lines[0])) title = (lines.shift() as string).trim()
  const items: Item[] = []
  for (const line of lines) {
    const m = ITEM.exec(line)
    if (m) items.push({ done: m[1] === 'x', text: m[2] })
    else if (line.trim()) items.push({ done: false, text: line.trim() })
  }
  return { title, items }
}

export function serializeTodo(title: string, items: Item[]): string {
  const rows = items.map((i) => `[${i.done ? 'x' : ' '}] ${i.text.replace(/\s*\n\s*/g, ' ')}`)
  return (title.trim() ? [title.trim().replace(/\s*\n\s*/g, ' '), ...rows] : rows).join('\n')
}

const bare: React.CSSProperties = { border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, margin: 0, minHeight: 0, borderRadius: 0, width: '100%', color: 'inherit', fontFamily: 'inherit' }

// A checklist card. Always editable (like Notion): click a task to type, Enter adds the next one, Backspace on an empty one removes it.
export default function TodoCard({ content, readOnly, onChange }: { content: string; readOnly: boolean; onChange: (text: string) => void }) {
  const start = useRef(parseTodo(content)).current
  const [title, setTitle] = useState(start.title)
  const [items, setItems] = useState<Item[]>(start.items.length || readOnly ? start.items : [{ done: false, text: '' }])
  const [focusIdx, setFocusIdx] = useState<number | null>(start.items.length === 0 && !readOnly ? 0 : null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const latest = useRef({ title, items })
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => {
    if (focusIdx === null) return
    inputs.current[focusIdx]?.focus()
    setFocusIdx(null)
  }, [focusIdx])

  // Saves shortly after you stop typing, and once more if the card goes away mid-edit.
  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(serializeTodo(latest.current.title, latest.current.items))
  }, [])

  function update(nextTitle: string, nextItems: Item[]) {
    setTitle(nextTitle)
    setItems(nextItems)
    latest.current = { title: nextTitle, items: nextItems }
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      send.current(serializeTodo(nextTitle, nextItems))
    }, 500)
  }

  const setItem = (i: number, patch: Partial<Item>) => update(title, items.map((it, k) => (k === i ? { ...it, ...patch } : it)))
  const addAfter = (i: number) => {
    update(title, [...items.slice(0, i + 1), { done: false, text: '' }, ...items.slice(i + 1)])
    setFocusIdx(i + 1)
  }
  const removeAt = (i: number) => {
    update(title, items.filter((_, k) => k !== i))
    setFocusIdx(Math.max(0, i - 1))
  }

  const done = items.filter((i) => i.done).length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" style={{ color: '#b5b5b5', fontSize: 11, letterSpacing: -2, userSelect: 'none', cursor: readOnly ? 'default' : 'move', padding: '2px 4px 2px 0' }}>⋮⋮</span>
        <input
          value={title}
          readOnly={readOnly}
          placeholder="To-do"
          aria-label="List title"
          onChange={(e) => update(e.target.value, items)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (items.length === 0) addAfter(-1)
              else inputs.current[0]?.focus()
            }
          }}
          style={{ ...bare, flex: 1, fontSize: 14, fontWeight: 700 }}
        />
        {items.length > 0 && <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>{done}/{items.length}</span>}
      </div>

      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={it.done}
            aria-label={it.done ? 'Mark as not done' : 'Mark as done'}
            disabled={readOnly}
            onClick={() => setItem(i, { done: !it.done })}
            style={{ flex: '0 0 auto', width: 16, height: 16, minHeight: 0, padding: 0, borderRadius: 4, border: `1.5px solid ${it.done ? 'var(--accent)' : '#a8a8a8'}`, background: it.done ? 'var(--accent)' : '#fff', color: '#fff', fontSize: 11, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: readOnly ? 'default' : 'pointer' }}
          >
            {it.done ? '✓' : ''}
          </button>
          <input
            ref={(el) => { inputs.current[i] = el }}
            value={it.text}
            readOnly={readOnly}
            placeholder="Add a task"
            aria-label={`Task ${i + 1}`}
            onChange={(e) => setItem(i, { text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAfter(i)
              } else if (e.key === 'Backspace' && it.text === '' && items.length > 1) {
                e.preventDefault()
                removeAt(i)
              } else if (e.key === 'ArrowUp' && i > 0) {
                e.preventDefault()
                inputs.current[i - 1]?.focus()
              } else if (e.key === 'ArrowDown' && i < items.length - 1) {
                e.preventDefault()
                inputs.current[i + 1]?.focus()
              }
            }}
            style={{ ...bare, flex: 1, fontSize: 13, height: 22, textDecoration: it.done ? 'line-through' : 'none', opacity: it.done ? 0.5 : 1 }}
          />
        </div>
      ))}

      {!readOnly && (
        <button type="button" onClick={() => addAfter(items.length - 1)} style={{ ...bare, width: 'auto', alignSelf: 'flex-start', fontSize: 12, color: '#999', cursor: 'pointer', textAlign: 'left' }}>
          + Add a task
        </button>
      )}
    </div>
  )
}
