'use client'

import { useEffect, useRef, useState } from 'react'

// A column is a labelled lane you place cards on (Shot list, To shoot, Done…). Moving the column moves the cards on top of it.
export default function ColumnCard({ content, readOnly, onChange }: { content: string; readOnly: boolean; onChange: (text: string) => void }) {
  const [title, setTitle] = useState(content)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const latest = useRef(title)
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(latest.current)
  }, [])

  return (
    <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border-strong)' }}>
      <input
        value={title}
        readOnly={readOnly}
        placeholder="Column title"
        aria-label="Column title"
        onChange={(e) => {
          const v = e.target.value.slice(0, 120)
          setTitle(v)
          latest.current = v
          dirty.current = true
          clearTimeout(timer.current)
          timer.current = setTimeout(() => {
            dirty.current = false
            send.current(v)
          }, 500)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
        style={{ border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, margin: 0, minHeight: 0, width: '100%', fontSize: 13, fontWeight: 700, letterSpacing: 0.2, color: 'var(--text-primary)', fontFamily: 'inherit' }}
      />
    </div>
  )
}
