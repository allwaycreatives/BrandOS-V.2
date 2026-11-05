'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { numberingOf, parseBlocks, splitDocument, type Block } from '@/lib/pageBlocks'
import PageEditor from './PageEditor'

export { joinDocument, splitDocument } from '@/lib/pageBlocks'

const SERIF = "Georgia, 'Times New Roman', serif"

function previewLine(b: Block, n: number, key: number) {
  const base: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  const text = b.text.replace(/\n/g, ' ')
  switch (b.type) {
    case 'h1': return <div key={key} style={{ ...base, fontSize: 13.5, fontWeight: 700, color: '#1a1a1a', fontFamily: SERIF }}>{text}</div>
    case 'h2': return <div key={key} style={{ ...base, fontSize: 13, fontWeight: 700, color: '#1a1a1a', fontFamily: SERIF }}>{text}</div>
    case 'h3': return <div key={key} style={{ ...base, fontWeight: 700, color: '#333' }}>{text}</div>
    case 'bullet': return <div key={key} style={base}>• {text}</div>
    case 'number': return <div key={key} style={base}>{n}. {text}</div>
    case 'todo': return <div key={key} style={{ ...base, textDecoration: b.done ? 'line-through' : 'none', opacity: b.done ? 0.6 : 1 }}>{b.done ? '☑' : '☐'} {text}</div>
    case 'quote': return <div key={key} style={{ ...base, fontStyle: 'italic', borderLeft: '2px solid #ccc', paddingLeft: 6 }}>{text}</div>
    case 'callout': return <div key={key} style={{ ...base, background: '#fff1ea', borderRadius: 4, padding: '1px 6px' }}>💡 {text}</div>
    case 'divider': return <div key={key} style={{ borderTop: '1px solid #ddd', margin: '5px 0' }} />
    case 'image': return <div key={key} style={base}>🖼 Image</div>
    case 'page': return <div key={key} style={{ ...base, color: '#1a1a1a' }}>{b.page?.icon || '📄'} {text || 'Untitled'}</div>
    default: return <div key={key} style={base}>{text}</div>
  }
}

// What sits on the board: a small page with its icon, title and the first few lines.
// Double-click it (or press Open) to open the full-screen page.
export default function DocumentCard({ content, readOnly, open, onOpen, onClose, onChange }: { content: string; readOnly: boolean; open: boolean; onOpen: () => void; onClose: () => void; onChange: (text: string) => void }) {
  const [text, setText] = useState(content)
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dirty = useRef(false)
  const latest = useRef(text)
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(latest.current)
  }, [])

  function edit(next: string) {
    setText(next)
    latest.current = next
    dirty.current = true
    setSaving(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      send.current(next)
      setSaving(false)
    }, 600)
  }

  const { title, body } = splitDocument(text)
  const { icon, blocks } = useMemo(() => parseBlocks(body), [body])
  const numbers = useMemo(() => numberingOf(blocks), [blocks])
  const shown = blocks.map((b, i) => ({ b, n: numbers[i] })).filter(({ b }) => b.type === 'divider' || b.type === 'image' || b.type === 'page' || b.text.trim()).slice(0, 6)

  return (
    <div style={{ color: '#1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {icon ? (
          <span aria-hidden="true" style={{ fontSize: 17, flex: '0 0 auto', lineHeight: 1 }}>{icon}</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto' }}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
        )}
        <div style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: title ? '#1a1a1a' : '#aaa' }}>{title || 'Untitled'}</div>
      </div>
      {shown.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{shown.map(({ b, n }, i) => previewLine(b, n, i))}</div>
      ) : (
        <div style={{ fontSize: 12, color: '#aaa' }}>{readOnly ? 'Empty page' : 'Click to start writing'}</div>
      )}
      <button type="button" onClick={onOpen} style={{ marginTop: 8, border: 'none', background: 'transparent', padding: 0, minHeight: 0, fontSize: 11.5, color: 'var(--accent-text)', cursor: 'pointer' }}>
        {readOnly ? 'Read' : 'Open page'} →
      </button>

      {open && typeof document !== 'undefined' && createPortal(<PageEditor value={text} readOnly={readOnly} saving={saving} onEdit={edit} onClose={onClose} />, document.body)}
    </div>
  )
}
