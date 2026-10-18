'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { filterSlash, joinDocument, newBlock, numberingOf, parseBlocks, parsePasted, serializeBlocks, shortcutFor, splitDocument, type Block, type SlashItem } from '@/lib/pageBlocks'
import { uploadFile } from '@/lib/uploadFile'

const SERIF = "Georgia, 'Times New Roman', serif"
const EMOJI = ['📄', '📝', '📌', '🎬', '📸', '🎨', '💡', '✅', '🎯', '🚀', '⭐', '🔥', '🌍', '📅', '💬', '🎵', '🧠', '📦', '🛠️', '❤️', '🌱', '🏆', '🗂️', '✨']

const bare: React.CSSProperties = { border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: 0, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0, minHeight: 0, borderRadius: 0, width: '100%', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 'inherit', fontStyle: 'inherit', boxSizing: 'border-box' }

const TEXT_STYLE: Record<string, React.CSSProperties> = {
  p: { fontSize: 16, lineHeight: 1.65 },
  h1: { fontSize: 30, lineHeight: 1.25, fontWeight: 700, fontFamily: SERIF, marginTop: 14 },
  h2: { fontSize: 24, lineHeight: 1.3, fontWeight: 700, fontFamily: SERIF, marginTop: 10 },
  h3: { fontSize: 19, lineHeight: 1.35, fontWeight: 700, fontFamily: SERIF, marginTop: 6 },
  bullet: { fontSize: 16, lineHeight: 1.65 },
  number: { fontSize: 16, lineHeight: 1.65 },
  todo: { fontSize: 16, lineHeight: 1.65 },
  quote: { fontSize: 16, lineHeight: 1.65, fontStyle: 'italic', color: 'var(--text-secondary)' },
  callout: { fontSize: 15.5, lineHeight: 1.6 },
}
const PLACEHOLDER: Record<string, string> = { h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', bullet: 'List item', number: 'List item', todo: 'To-do', quote: 'Quote', callout: 'Type something to call out' }

const firstLine = (el: HTMLTextAreaElement) => !el.value.slice(0, el.selectionStart).includes('\n')
const lastLine = (el: HTMLTextAreaElement) => !el.value.slice(el.selectionEnd).includes('\n')

// A Notion-style page: big title, optional emoji, and blocks you type into.
// Type "/" for the block menu, or use shortcuts like "# ", "- ", "[] ", "> ". Drag the ⋮⋮ handle to reorder.
export default function PageEditor({ value, readOnly, saving, onEdit, onClose }: { value: string; readOnly: boolean; saving: boolean; onEdit: (content: string) => void; onClose: () => void }) {
  const [initial] = useState(() => {
    const { title, body } = splitDocument(value)
    return { title, ...parseBlocks(body) }
  })
  const [title, setTitle] = useState(initial.title)
  const [icon, setIcon] = useState(initial.icon)
  const [blocks, setBlocks] = useState<Block[]>(initial.blocks)
  const [focus, setFocus] = useState<{ id: string; pos: number | 'end' } | null>(null)
  const [slash, setSlash] = useState<{ id: string; query: string; index: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fields = useRef(new Map<string, HTMLTextAreaElement>())
  const holders = useRef(new Map<string, HTMLDivElement>())
  const titleField = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const imageFor = useRef<string | null>(null)
  const latest = useRef({ title, icon, blocks })
  latest.current = { title, icon, blocks }

  function commit(next: { title?: string; icon?: string; blocks?: Block[] }) {
    const t = next.title ?? latest.current.title
    const i = next.icon ?? latest.current.icon
    const b = next.blocks ?? latest.current.blocks
    latest.current = { title: t, icon: i, blocks: b }
    setTitle(t)
    setIcon(i)
    setBlocks(b)
    onEdit(joinDocument(t, serializeBlocks(i, b)))
  }
  const setList = (next: Block[]) => commit({ blocks: next })
  const patch = (id: string, change: Partial<Block>) => setList(latest.current.blocks.map((b) => (b.id === id ? { ...b, ...change } : b)))

  useLayoutEffect(() => {
    if (!focus) return
    const ta = fields.current.get(focus.id)
    if (ta) {
      ta.focus()
      const p = focus.pos === 'end' ? ta.value.length : Math.min(focus.pos, ta.value.length)
      ta.setSelectionRange(p, p)
    } else holders.current.get(focus.id)?.focus()
    setFocus(null)
  }, [focus])

  // Text boxes grow with what is typed.
  useLayoutEffect(() => {
    fields.current.forEach((el) => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    })
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (slash) setSlash(null)
      else if (emojiOpen) setEmojiOpen(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slash, emojiOpen, onClose])

  const goto = (index: number, pos: number | 'end') => {
    const target = latest.current.blocks[index]
    if (target) setFocus({ id: target.id, pos })
  }

  function applySlash(id: string, item: SlashItem) {
    setSlash(null)
    const list = latest.current.blocks
    const i = list.findIndex((b) => b.id === id)
    if (i < 0) return
    if (item.type === 'divider') {
      const next = [...list]
      next[i] = { ...list[i], type: 'divider', text: '', done: false }
      const after = newBlock()
      next.splice(i + 1, 0, after)
      setList(next)
      setFocus({ id: after.id, pos: 0 })
      return
    }
    if (item.type === 'image') {
      imageFor.current = id
      patch(id, { type: 'image', text: '', done: false })
      fileInput.current?.click()
      return
    }
    patch(id, { type: item.type, text: '', done: false })
    setFocus({ id, pos: 0 })
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const id = imageFor.current
    imageFor.current = null
    if (!file || !id) return
    setUploading(id)
    try {
      const res = await uploadFile(file)
      patch(id, { type: 'image', text: res.url })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That image could not be uploaded.')
    } finally {
      setUploading(null)
    }
  }

  function split(b: Block, i: number, start: number, end: number) {
    const listy = b.type === 'bullet' || b.type === 'number' || b.type === 'todo'
    if ((listy || b.type === 'quote' || b.type === 'callout') && b.text === '') {
      patch(b.id, { type: 'p' }) // Enter on an empty list item ends the list
      setFocus({ id: b.id, pos: 0 })
      return
    }
    const fresh = newBlock(listy ? b.type : 'p', b.text.slice(end))
    const next = [...latest.current.blocks]
    next[i] = { ...b, text: b.text.slice(0, start) }
    next.splice(i + 1, 0, fresh)
    setList(next)
    setFocus({ id: fresh.id, pos: 0 })
  }

  function backspaceAtStart(b: Block, i: number) {
    const list = latest.current.blocks
    if (b.type !== 'p') {
      patch(b.id, { type: 'p' })
      setFocus({ id: b.id, pos: 0 })
      return
    }
    if (i === 0) return
    const prev = list[i - 1]
    if (prev.type === 'divider' || prev.type === 'image') {
      setList(list.filter((x) => x.id !== prev.id))
      return
    }
    setList(list.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, text: prev.text + b.text } : x)))
    setFocus({ id: prev.id, pos: prev.text.length })
  }

  function removeBlock(i: number) {
    const list = latest.current.blocks
    if (list.length === 1) {
      const blank = newBlock()
      setList([blank])
      setFocus({ id: blank.id, pos: 0 })
      return
    }
    setList(list.filter((_, k) => k !== i))
    goto(Math.max(0, i - 1), 'end')
  }

  function addBelow(i: number) {
    const fresh = newBlock()
    const next = [...latest.current.blocks]
    next.splice(i + 1, 0, fresh)
    setList(next)
    setFocus({ id: fresh.id, pos: 0 })
  }

  function moveDragged() {
    const list = latest.current.blocks
    const from = list.findIndex((x) => x.id === dragId)
    let to = dropAt
    setDragId(null)
    setDropAt(null)
    if (from < 0 || to === null) return
    if (from < to) to -= 1
    if (to === from) return
    const next = list.filter((_, k) => k !== from)
    next.splice(to, 0, list[from])
    setList(next)
  }

  function onType(b: Block, i: number, v: string) {
    if (b.type === 'p') {
      const sc = shortcutFor(v)
      if (sc?.type === 'divider') {
        const next = [...latest.current.blocks]
        next[i] = { ...b, type: 'divider', text: '', done: false }
        const after = newBlock()
        next.splice(i + 1, 0, after)
        setList(next)
        setFocus({ id: after.id, pos: 0 })
        return
      }
      if (sc) {
        patch(b.id, { type: sc.type, text: sc.text, done: !!sc.done })
        setFocus({ id: b.id, pos: 'end' })
        return
      }
      if (v.startsWith('/') && !/\s/.test(v)) {
        setSlash(filterSlash(v.slice(1)).length ? { id: b.id, query: v.slice(1), index: 0 } : null)
      } else if (slash?.id === b.id) setSlash(null)
    }
    patch(b.id, { text: v })
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) {
    const el = e.currentTarget
    if (slash?.id === b.id) {
      const items = filterSlash(slash.query)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        setSlash({ ...slash, index: (slash.index + step + items.length) % items.length })
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (items[slash.index]) applySlash(b.id, items[slash.index])
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      split(b, i, el.selectionStart, el.selectionEnd)
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
      e.preventDefault()
      backspaceAtStart(b, i)
    } else if (e.key === 'ArrowUp' && el.selectionStart === el.selectionEnd && firstLine(el)) {
      e.preventDefault()
      if (i === 0) titleField.current?.focus()
      else goto(i - 1, 'end')
    } else if (e.key === 'ArrowDown' && el.selectionStart === el.selectionEnd && lastLine(el)) {
      e.preventDefault()
      goto(i + 1, 0)
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>, b: Block, i: number) {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\n')) return
    e.preventDefault()
    const parsed = parsePasted(text)
    const replace = b.type === 'p' && b.text === ''
    const next = [...latest.current.blocks]
    next.splice(replace ? i : i + 1, replace ? 1 : 0, ...parsed)
    setList(next)
    setFocus({ id: parsed[parsed.length - 1].id, pos: 'end' })
  }

  const numbers = numberingOf(blocks)
  const slashItems = slash ? filterSlash(slash.query) : []

  return (
    <div role="dialog" aria-modal="true" aria-label="Document" className="page-overlay" data-page-overlay onPointerDown={(e) => e.stopPropagation()}>
      <header className="page-bar">
        <button type="button" onClick={onClose} className="page-back">← Back to board</button>
        <span className="page-bar-title">{icon ? `${icon} ` : ''}{title || 'Untitled'}</span>
        <span className="page-bar-status" aria-live="polite">{readOnly ? 'View only' : saving ? 'Saving…' : 'Saved'}</span>
      </header>

      <div className="page-scroll">
        <div className="page-col">
          <div style={{ position: 'relative', marginBottom: 6 }}>
            {icon ? (
              <button type="button" disabled={readOnly} onClick={() => setEmojiOpen((o) => !o)} aria-label="Change icon" style={{ ...bare, width: 'auto', fontSize: 52, lineHeight: 1.1, cursor: readOnly ? 'default' : 'pointer' }}>{icon}</button>
            ) : (
              !readOnly && <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="page-add-icon">☺ Add icon</button>
            )}
            {emojiOpen && !readOnly && (
              <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 6, width: 268, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
                {EMOJI.map((em) => (
                  <button key={em} type="button" role="menuitem" onClick={() => { commit({ icon: em }); setEmojiOpen(false) }} style={{ ...bare, width: 'auto', fontSize: 20, padding: 4, cursor: 'pointer', borderRadius: 6 }}>{em}</button>
                ))}
                {icon && <button type="button" onClick={() => { commit({ icon: '' }); setEmojiOpen(false) }} style={{ ...bare, gridColumn: '1 / -1', width: 'auto', fontSize: 12, color: 'var(--text-muted)', padding: '6px 4px', cursor: 'pointer' }}>Remove icon</button>}
              </div>
            )}
          </div>

          <input
            ref={titleField}
            value={title}
            readOnly={readOnly}
            placeholder="Untitled"
            aria-label="Page title"
            onChange={(e) => commit({ title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                goto(0, 0)
              }
            }}
            style={{ ...bare, fontFamily: SERIF, fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginBottom: 18 }}
          />

          {blocks.map((b, i) => {
            const style = TEXT_STYLE[b.type] ?? TEXT_STYLE.p
            const isMedia = b.type === 'divider' || b.type === 'image'
            return (
              <div
                key={b.id}
                className="pg-row"
                onDragOver={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1)
                }}
                onDrop={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  moveDragged()
                }}
              >
                {dragId && dropAt === i && <div className="pg-drop" />}
                {!readOnly && (
                  <div className="pg-tools">
                    <button type="button" className="pg-btn" aria-label="Add a block below" title="Add a block below" onClick={() => addBelow(i)}>＋</button>
                    <span className="pg-btn pg-grab" draggable role="button" aria-label="Drag to move" title="Drag to move" onDragStart={(e) => { setDragId(b.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'block') }} onDragEnd={() => { setDragId(null); setDropAt(null) }}>⋮⋮</span>
                  </div>
                )}

                {b.type === 'divider' && (
                  <div ref={(el) => { if (el) holders.current.set(b.id, el); else holders.current.delete(b.id) }} tabIndex={readOnly ? -1 : 0} role="separator" className="pg-holder"
                    onKeyDown={(e) => {
                      if (readOnly) return
                      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeBlock(i) }
                      else if (e.key === 'Enter') { e.preventDefault(); addBelow(i) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); goto(i - 1, 'end') }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); goto(i + 1, 0) }
                    }}>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-strong)', margin: '14px 0' }} />
                  </div>
                )}

                {b.type === 'image' && (
                  <div ref={(el) => { if (el) holders.current.set(b.id, el); else holders.current.delete(b.id) }} tabIndex={readOnly ? -1 : 0} className="pg-holder" style={{ margin: '8px 0' }}
                    onKeyDown={(e) => {
                      if (readOnly) return
                      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeBlock(i) }
                      else if (e.key === 'Enter') { e.preventDefault(); addBelow(i) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); goto(i - 1, 'end') }
                      else if (e.key === 'ArrowDown') { e.preventDefault(); goto(i + 1, 0) }
                    }}>
                    {b.text ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.text} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 8 }} />
                    ) : (
                      <button type="button" disabled={readOnly || uploading === b.id} onClick={() => { imageFor.current = b.id; fileInput.current?.click() }} style={{ ...bare, width: '100%', padding: '22px 16px', border: '1px dashed var(--border-strong)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', textAlign: 'center' }}>
                        {uploading === b.id ? 'Uploading…' : '＋ Add an image'}
                      </button>
                    )}
                  </div>
                )}

                {!isMedia && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, ...(b.type === 'quote' ? { borderLeft: '3px solid var(--text-muted)', paddingLeft: 14, margin: '4px 0' } : {}), ...(b.type === 'callout' ? { background: 'var(--accent-dim)', borderRadius: 8, padding: '12px 14px', margin: '6px 0' } : {}) }}>
                    {b.type === 'bullet' && <span aria-hidden="true" style={{ ...style, flex: '0 0 18px', textAlign: 'center' }}>•</span>}
                    {b.type === 'number' && <span aria-hidden="true" style={{ ...style, flex: '0 0 24px', textAlign: 'right', color: 'var(--text-secondary)' }}>{numbers[i]}.</span>}
                    {b.type === 'callout' && <span aria-hidden="true" style={{ ...style, flex: '0 0 22px' }}>💡</span>}
                    {b.type === 'todo' && (
                      <button type="button" role="checkbox" aria-checked={b.done} aria-label={b.done ? 'Mark as not done' : 'Mark as done'} disabled={readOnly} onClick={() => patch(b.id, { done: !b.done })}
                        style={{ flex: '0 0 18px', width: 18, height: 18, minHeight: 0, padding: 0, marginTop: 4, borderRadius: 4, border: `1.5px solid ${b.done ? 'var(--accent)' : 'var(--text-muted)'}`, background: b.done ? 'var(--accent)' : 'transparent', color: '#fff', fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: readOnly ? 'default' : 'pointer' }}>{b.done ? '✓' : ''}</button>
                    )}
                    <textarea
                      ref={(el) => { if (el) fields.current.set(b.id, el); else fields.current.delete(b.id) }}
                      value={b.text}
                      rows={1}
                      readOnly={readOnly}
                      aria-label={b.type === 'p' ? 'Text' : (PLACEHOLDER[b.type] ?? 'Text')}
                      placeholder={readOnly ? '' : blocks.length === 1 && b.type === 'p' ? "Type '/' for blocks, or just start writing…" : (PLACEHOLDER[b.type] ?? '')}
                      onChange={(e) => onType(b, i, e.target.value)}
                      onKeyDown={(e) => onKey(e, b, i)}
                      onPaste={(e) => onPaste(e, b, i)}
                      style={{ ...bare, ...style, flex: 1, minWidth: 0, resize: 'none', overflow: 'hidden', display: 'block', ...(b.type === 'todo' && b.done ? { textDecoration: 'line-through', opacity: 0.5 } : {}) }}
                    />
                  </div>
                )}

                {slash?.id === b.id && slashItems.length > 0 && (
                  <div role="listbox" aria-label="Block types" style={{ position: 'absolute', left: 0, top: '100%', zIndex: 7, width: 290, maxHeight: 320, overflowY: 'auto', padding: 6, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 14px 36px rgba(0,0,0,0.45)' }}>
                    {slashItems.map((it, k) => (
                      <button key={it.type} type="button" role="option" aria-selected={k === slash.index}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applySlash(b.id, it)}
                        style={{ ...bare, display: 'block', textAlign: 'left', padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: k === slash.index ? 'var(--accent-dim)' : 'transparent' }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{it.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{it.hint}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {dragId && dropAt === blocks.length && <div className="pg-drop" />}
          {!readOnly && (
            <div
              style={{ minHeight: 140, cursor: 'text' }}
              aria-hidden="true"
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropAt(blocks.length) } }}
              onDrop={(e) => { if (dragId) { e.preventDefault(); moveDragged() } }}
              onClick={() => {
                const last = blocks[blocks.length - 1]
                if (last && last.type === 'p' && last.text === '') setFocus({ id: last.id, pos: 0 })
                else {
                  const fresh = newBlock()
                  setList([...blocks, fresh])
                  setFocus({ id: fresh.id, pos: 0 })
                }
              }}
            />
          )}
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/*" onChange={onPickImage} style={{ display: 'none' }} />
    </div>
  )
}
