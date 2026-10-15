'use client'

import { useEffect, useRef, useState } from 'react'

// A small box that appears beside the tools, in place of a browser pop-up. Type, press Enter, done. Esc closes it.
export default function BoardPrompt({
  title,
  placeholder,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string
  placeholder: string
  initial: string
  submitLabel: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  return (
    <div
      data-nodrag
      role="dialog"
      aria-label={title}
      style={{ position: 'absolute', left: 76, top: 12, zIndex: 7, width: 320, maxWidth: 'calc(100% - 90px)', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) onSubmit(value.trim())
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }}
          placeholder={placeholder}
          aria-label={title}
          style={{ flex: 1, minWidth: 0 }}
        />
        <button type="submit" className="primary" disabled={!value.trim()}>{submitLabel}</button>
      </form>
      <button type="button" onClick={onCancel} style={{ marginTop: 8, fontSize: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>Cancel</button>
    </div>
  )
}
