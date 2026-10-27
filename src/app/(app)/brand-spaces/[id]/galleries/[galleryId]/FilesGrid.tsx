'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { createSet, deleteItems, deleteSet, moveItems, moveSet, readCaptureDates, renameMainSet, renameSet, setGalleryCover, setSortMode } from '../actions'
import { formatBytes } from '@/lib/galleryFormat'
import { SORT_MODES, sectionize, sortItems } from '@/lib/gallerySort'

export type AdminItem = {
  id: string
  name: string
  kind: 'image' | 'video' | 'file'
  size: number
  preview: string | null // small picture for the grid
  view: string | null // bigger picture (or the video) for the viewer
  setId: string | null
  capturedAt: string | null
}
export type AdminSet = { id: string; name: string }

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '')
const btn = { border: 'none', background: 'transparent', padding: 0, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' } as const

export default function FilesGrid({
  galleryId, items, sets, mainSetName, coverItemId, sortMode, canReadDates,
}: {
  galleryId: string
  items: AdminItem[]
  sets: AdminSet[]
  mainSetName: string
  coverItemId: string | null
  sortMode: string
  canReadDates: boolean
}) {
  const [tab, setTab] = useState<string>('all') // all | main | <set id>
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [viewer, setViewer] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [newName, setNewName] = useState('')
  const [pending, start] = useTransition()
  const lastClicked = useRef<number | null>(null)

  const sections = useMemo(() => sectionize(items, sets, mainSetName, sortMode), [items, sets, mainSetName, sortMode])
  const shownSections = tab === 'all' ? sections : sections.filter((s) => (tab === 'main' ? s.id === null : s.id === tab))
  const shown = shownSections.flatMap((s) => s.items)
  const undated = items.filter((i) => !i.capturedAt).length
  const activeSet = sets.find((s) => s.id === tab)

  // the chosen tab can disappear (a deleted section)
  useEffect(() => {
    if (tab !== 'all' && tab !== 'main' && !sets.some((s) => s.id === tab)) setTab('all')
  }, [sets, tab])

  const run = (fn: () => Promise<unknown>) => start(async () => { await fn() })

  const toggle = (id: string, index: number, shift: boolean) => {
    const anchor = lastClicked.current // read it now: it is updated just below, before React runs the update
    lastClicked.current = index
    setSel((prev) => {
      const next = new Set(prev)
      if (shift && anchor !== null) {
        const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)]
        for (let i = a; i <= b; i++) if (shown[i]) next.add(shown[i].id)
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (viewer === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null)
      else if (e.key === 'ArrowRight') setViewer((i) => (i === null ? i : (i + 1) % shown.length))
      else if (e.key === 'ArrowLeft') setViewer((i) => (i === null ? i : (i - 1 + shown.length) % shown.length))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [viewer, shown.length])

  const ids = Array.from(sel)
  const cur = viewer !== null ? shown[viewer] : null
  const tabBtn = (key: string, label: string, count: number) => (
    <button key={key} type="button" onClick={() => { setTab(key); setSel(new Set()) }} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 13, border: `1px solid ${tab === key ? 'var(--accent)' : 'var(--border)'}`, background: tab === key ? 'var(--accent-dim)' : 'transparent', color: 'var(--text-primary, inherit)', cursor: 'pointer' }}>
      {label} <span style={{ color: 'var(--text-muted)' }}>{count}</span>
    </button>
  )

  const tile = (it: AdminItem, index: number) => {
    const picked = sel.has(it.id)
    return (
      <div key={it.id} className="fg-tile" style={{ opacity: pending ? 0.75 : 1 }}>
        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--bg-card)', border: `2px solid ${picked ? 'var(--accent)' : coverItemId === it.id ? 'var(--text-secondary)' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={(e) => (sel.size > 0 ? toggle(it.id, index, e.shiftKey) : setViewer(index))}
            aria-label={`Open ${it.name}`}
            style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in' }}
          >
            {it.preview ? (
              <img src={it.preview} alt={it.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>{it.kind === 'video' ? '▶ Video' : 'No preview'}</span>
            )}
          </button>
          {it.kind === 'video' && <span style={{ position: 'absolute', right: 6, bottom: 6, background: 'rgba(0,0,0,.65)', color: '#fff', fontSize: 11, padding: '1px 6px', borderRadius: 4 }}>▶</span>}
          {coverItemId === it.id && <span style={{ position: 'absolute', right: 6, top: 6, background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>Cover</span>}
          <button
            type="button"
            className={`fg-check${picked ? ' on' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggle(it.id, index, e.shiftKey) }}
            aria-label={picked ? `Unselect ${it.name}` : `Select ${it.name}`}
            aria-pressed={picked}
            style={{ position: 'absolute', left: 6, top: 6, width: 24, height: 24, borderRadius: 12, border: '2px solid #fff', background: picked ? 'var(--accent)' : 'rgba(0,0,0,.35)', color: '#000', fontSize: 14, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            {picked ? '✓' : ''}
          </button>
        </div>
        <div style={{ fontSize: 11.5, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatBytes(it.size)}{it.capturedAt ? ` · ${when(it.capturedAt)}` : ''}</div>
      </div>
    )
  }

  let counter = 0
  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: '.fg-check{opacity:0;transition:opacity .15s}.fg-tile:hover .fg-check,.fg-check.on{opacity:1}@media (hover:none){.fg-check{opacity:1}}' }} />

      {/* sections */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        {tabBtn('all', 'All', items.length)}
        {sets.length > 0 && tabBtn('main', mainSetName, items.filter((i) => !i.setId || !sets.some((s) => s.id === i.setId)).length)}
        {sets.map((s) => tabBtn(s.id, s.name, items.filter((i) => i.setId === s.id).length))}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = newName.trim()
            if (!name) return
            run(async () => {
              const r = await createSet(galleryId, name)
              if ('ok' in r) { setNewName(''); setTab(r.id) } else setNote(r.error)
            })
          }}
          style={{ display: 'flex', gap: 6 }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="+ New section, like “Winners”" style={{ width: 200, fontSize: 13, padding: '5px 10px' }} aria-label="New section name" />
          {newName.trim() && <button type="submit" disabled={pending} style={{ fontSize: 13 }}>Add</button>}
        </form>
      </div>

      {sets.length === 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
          Tip: make sections like “The event” and “Winners & graduation”, then select photos and move them. Your client sees each as its own tab, in the order you choose.
        </div>
      )}

      {/* section tools */}
      {(activeSet || (tab === 'main' && sets.length > 0)) && (
        <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, padding: '10px 12px' }}>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Section name{' '}
            <input
              key={tab + (activeSet?.name ?? mainSetName)}
              defaultValue={activeSet ? activeSet.name : mainSetName}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== (activeSet ? activeSet.name : mainSetName)) run(() => (activeSet ? renameSet(activeSet.id, v) : renameMainSet(galleryId, v))) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              style={{ fontSize: 13, padding: '4px 8px', marginLeft: 4 }}
            />
          </label>
          {activeSet && (
            <>
              <button type="button" style={btn} disabled={pending} onClick={() => run(() => moveSet(activeSet.id, -1))}>↑ Earlier</button>
              <button type="button" style={btn} disabled={pending} onClick={() => run(() => moveSet(activeSet.id, 1))}>↓ Later</button>
              <button type="button" style={{ ...btn, color: '#c0392b' }} disabled={pending} onClick={() => { if (confirm(`Delete the section “${activeSet.name}”? Its photos are not deleted; they go back to “${mainSetName}”.`)) run(() => deleteSet(activeSet.id)) }}>Delete section</button>
            </>
          )}
        </div>
      )}

      {/* order */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12, fontSize: 12.5, color: 'var(--text-secondary)' }}>
        <label>
          Order{' '}
          <select value={sortMode} onChange={(e) => run(() => setSortMode(galleryId, e.target.value))} style={{ fontSize: 12.5, padding: '4px 8px' }}>
            {SORT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        {canReadDates && undated > 0 && sortMode !== 'name' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(async () => {
              setNote('Reading when each photo was taken…')
              const r = await readCaptureDates(galleryId)
              setNote('error' in r ? r.error : `Found the date for ${r.found} of ${r.total} photos.`)
            })}
            style={{ fontSize: 12.5 }}
          >
            Read “date taken” from {undated} photo{undated === 1 ? '' : 's'}
          </button>
        )}
        <button type="button" style={btn} onClick={() => setSel(new Set(shown.map((i) => i.id)))}>Select all{tab === 'all' ? '' : ' here'}</button>
        {note && <span style={{ color: 'var(--text-secondary)' }}>{note}</span>}
      </div>

      {/* selection bar */}
      {sel.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 12px', margin: '0 0 12px', background: 'var(--bg-card)', border: '1px solid var(--accent)', borderRadius: 12 }}>
          <strong style={{ fontSize: 13 }}>{sel.size} selected</strong>
          <label style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Move to{' '}
            <select
              value=""
              disabled={pending}
              onChange={(e) => { const v = e.target.value; if (!v) return; run(async () => { await moveItems(galleryId, ids, v === '__main' ? null : v); setSel(new Set()) }) }}
              style={{ fontSize: 12.5, padding: '4px 8px' }}
              aria-label="Move selected photos to a section"
            >
              <option value="">choose a section…</option>
              <option value="__main">{mainSetName}</option>
              {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          {ids.length === 1 && items.find((i) => i.id === ids[0])?.kind === 'image' && <button type="button" disabled={pending} onClick={() => run(() => setGalleryCover(galleryId, ids[0]))} style={{ fontSize: 12.5 }}>Make cover</button>}
          <button type="button" disabled={pending} onClick={() => { if (confirm(`Delete ${ids.length} file${ids.length === 1 ? '' : 's'}? They are removed from storage too.`)) run(async () => { await deleteItems(galleryId, ids); setSel(new Set()) }) }} style={{ fontSize: 12.5, color: '#c0392b' }}>Delete</button>
          <button type="button" style={btn} onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      {/* the photos */}
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing here yet.</div>
      ) : (
        shownSections.map((sec) => (
          <div key={sec.id ?? 'main'} style={{ marginBottom: 22 }}>
            {(tab === 'all' && sets.length > 0) && <div style={{ fontWeight: 600, fontSize: 14, margin: '4px 0 8px' }}>{sec.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{sec.items.length}</span></div>}
            {sec.items.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No photos in this section yet. Select photos in “All” and choose “Move to”, or pick this section when you upload.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 14 }}>
                {sec.items.map((it) => tile(it, counter++))}
              </div>
            )}
          </div>
        ))
      )}

      {/* viewer */}
      {cur && viewer !== null && (
        <div role="dialog" aria-modal="true" aria-label={cur.name} onClick={() => setViewer(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.94)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
            <span>{viewer + 1} / {shown.length} · {cur.name} <span style={{ color: '#aaa' }}>· {formatBytes(cur.size)}{cur.capturedAt ? ` · ${when(cur.capturedAt)}` : ''}</span></span>
            <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <select
                value={cur.setId ?? '__main'}
                disabled={pending}
                onChange={(e) => run(() => moveItems(galleryId, [cur.id], e.target.value === '__main' ? null : e.target.value))}
                style={{ fontSize: 12.5, padding: '3px 6px' }}
                aria-label="Section"
              >
                <option value="__main">{mainSetName}</option>
                {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {cur.kind === 'image' && coverItemId !== cur.id && <button type="button" disabled={pending} onClick={() => run(() => setGalleryCover(galleryId, cur.id))} style={{ background: 'transparent', border: '1px solid #666', color: '#fff', borderRadius: 8, padding: '3px 10px', fontSize: 12.5 }}>Make cover</button>}
              <button type="button" disabled={pending} onClick={() => { if (confirm(`Delete “${cur.name}”?`)) run(async () => { await deleteItems(galleryId, [cur.id]); setViewer(null) }) }} style={{ background: 'transparent', border: '1px solid #666', color: '#ff8a80', borderRadius: 8, padding: '3px 10px', fontSize: 12.5 }}>Delete</button>
              <button type="button" onClick={() => setViewer(null)} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 26, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 56px 16px' }}>
            <button type="button" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setViewer((i) => (i === null ? i : (i - 1 + shown.length) % shown.length)) }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: 22, fontSize: 22 }}>‹</button>
            <button type="button" aria-label="Next" onClick={(e) => { e.stopPropagation(); setViewer((i) => (i === null ? i : (i + 1) % shown.length)) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: 22, fontSize: 22 }}>›</button>
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cur.kind === 'video' && cur.view ? (
                <video key={cur.id} src={cur.view} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: 'calc(100svh - 110px)', background: '#000' }} />
              ) : cur.view || cur.preview ? (
                <img key={cur.id} src={cur.view || cur.preview || ''} alt={cur.name} style={{ maxWidth: '100%', maxHeight: 'calc(100svh - 110px)', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#aaa' }}>No preview for this file type.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
