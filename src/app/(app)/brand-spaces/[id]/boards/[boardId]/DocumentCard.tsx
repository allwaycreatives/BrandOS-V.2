'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const SERIF = "Georgia, 'Times New Roman', serif"

// Stored as plain text: the first line is the title, everything after it is the page.
export function splitDocument(content: string) {
  const i = content.indexOf('\n')
  return i < 0 ? { title: content, body: '' } : { title: content.slice(0, i), body: content.slice(i + 1) }
}
export const joinDocument = (title: string, body: string) => `${title.replace(/\n/g, ' ')}\n${body}`

// What sits on the board: a small page with its title and the first few lines. Double-click (or the Open button) to write.
export default function DocumentCard({ content, readOnly, open, onOpen, onClose, onChange }: { content: string; readOnly: boolean; open: boolean; onOpen: () => void; onClose: () => void; onChange: (text: string) => void }) {
  const [text, setText] = useState(content)
  const { title, body } = splitDocument(text)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const dirty = useRef(false)
  const latest = useRef(text)
  const send = useRef(onChange)
  send.current = onChange

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (dirty.current) send.current(latest.current)
  }, [])

  function edit(nextTitle: string, nextBody: string) {
    const next = joinDocument(nextTitle, nextBody)
    setText(next)
    latest.current = next
    dirty.current = true
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      send.current(next)
    }, 600)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div style={{ color: '#1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: '0 0 auto' }}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
        <div style={{ flex: 1, minWidth: 0, fontFamily: SERIF, fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: title ? '#1a1a1a' : '#aaa' }}>{title || 'Untitled document'}</div>
      </div>
      {body.trim() ? (
        <div style={{ fontSize: 12, lineHeight: 1.5, color: '#555', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{body}</div>
      ) : (
        <div style={{ fontSize: 12, color: '#aaa' }}>{readOnly ? 'Empty' : 'Double-click to start writing'}</div>
      )}
      <button type="button" onClick={onOpen} style={{ marginTop: 8, border: 'none', background: 'transparent', padding: 0, minHeight: 0, fontSize: 11.5, color: 'var(--accent-text)', cursor: 'pointer' }}>
        {readOnly ? 'Read' : 'Open'} →
      </button>

      {open && typeof document !== 'undefined' &&
        createPortal(
          <div onPointerDown={(e) => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div role="dialog" aria-label="Document" style={{ width: 'min(760px, 100%)', height: 'min(82vh, 900px)', background: '#fff', color: '#1a1a1a', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #eee' }}>
                <span style={{ fontSize: 12, color: '#999' }}>{readOnly ? 'Document' : 'Saves as you type'}</span>
                <button type="button" onClick={onClose} style={{ border: 'none', background: '#1a1a1a', color: '#fff', borderRadius: 8, padding: '6px 14px', minHeight: 0, fontSize: 13, cursor: 'pointer' }}>Done</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '28px clamp(20px, 6vw, 56px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input
                  value={title}
                  readOnly={readOnly}
                  placeholder="Untitled document"
                  aria-label="Document title"
                  onChange={(e) => edit(e.target.value, body)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', boxShadow: 'none', padding: 0, minHeight: 0, width: '100%', fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: '#1a1a1a' }}
                />
                <textarea
                  value={body}
                  readOnly={readOnly}
                  placeholder={readOnly ? '' : 'Write something…'}
                  aria-label="Document text"
                  onChange={(e) => edit(title, e.target.value)}
                  style={{ flex: 1, minHeight: 300, border: 'none', outline: 'none', background: 'transparent', boxShadow: 'none', padding: 0, resize: 'none', width: '100%', fontFamily: 'inherit', fontSize: 15.5, lineHeight: 1.7, color: '#222' }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
