'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ZipWriter } from '@/lib/zipStream'
import { downloadUrlOf, formatBytes, isServedByBrandOS } from '@/lib/galleryFormat'
import { canSaveToDisk, rangedStream, saveLargeFile } from '@/lib/rangedFetch'
import { GALLERY_CSS, themeVars } from '@/lib/galleryTheme'

export type ViewItem = {
  id: string
  name: string
  kind: 'image' | 'video' | 'file'
  size: number
  w: number | null
  h: number | null
  thumb: string | null
  display: string | null // the picture to look at (a smaller copy for big photos)
  full: string | null // the untouched original, for downloads and video
}

const slug = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'gallery'

type Dl =
  | { state: 'idle' }
  | { state: 'zipping'; done: number; total: number; bytes: number; totalBytes: number }
  | { state: 'sequential'; done: number; total: number }
  | { state: 'single'; name: string; bytes: number; total: number }
  | { state: 'finished'; note: string }
  | { state: 'error'; message: string }

type Filter = 'all' | 'image' | 'video'

// An <img> that fades in once it has loaded (and also when it was already loaded before the page came alive).
function Pic({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      ref={(el) => {
        if (el && el.complete && el.naturalWidth > 0) el.classList.add('on')
      }}
      onLoad={(e) => e.currentTarget.classList.add('on')}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  )
}

export default function GalleryView({
  title, brand, subtitle, preparedFor, description, dateLabel, cover, allowDownload, theme, coverStyle, items,
}: {
  title: string
  brand: string
  subtitle: string | null
  preparedFor: string | null
  description: string | null
  dateLabel: string
  cover: string | null
  allowDownload: boolean
  theme: string
  coverStyle: string
  items: ViewItem[]
}) {
  const [open, setOpen] = useState<number | null>(null)
  const [dl, setDl] = useState<Dl>({ state: 'idle' })
  const [filter, setFilter] = useState<Filter>('all')
  const [cols, setCols] = useState(3)
  const gridRef = useRef<HTMLDivElement>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  const touchX = useRef<number | null>(null)

  const photos = items.filter((i) => i.kind === 'image').length
  const videos = items.filter((i) => i.kind === 'video').length
  const visible = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kind === filter)), [items, filter])
  const totalBytes = items.reduce((n, i) => n + i.size, 0)
  const downloadable = allowDownload ? items.filter((i) => i.full) : []

  const go = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + visible.length) % visible.length)), [visible.length])

  // Photos flow left to right, row by row, in file-name order (like a contact sheet), in as many columns as fit.
  useEffect(() => {
    const el = colsRef.current
    if (!el) return
    const fit = () => setCols(Math.max(1, Math.min(6, Math.round(el.clientWidth / 300))))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible.length])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // load the next and previous pictures ahead of time, so flicking through feels instant
    for (const d of [1, -1]) {
      const n = visible[(open + d + visible.length) % visible.length]
      const src = n?.display || n?.thumb
      if (src && n.kind !== 'video') new Image().src = src
    }
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, go, visible])

  async function sequential(list: ViewItem[]) {
    for (let i = 0; i < list.length; i++) {
      setDl({ state: 'sequential', done: i, total: list.length })
      const a = document.createElement('a')
      a.href = downloadUrlOf(list[i].full!)
      a.download = list[i].name
      document.body.appendChild(a)
      a.click()
      a.remove()
      await new Promise((r) => setTimeout(r, 900))
    }
    setDl({ state: 'finished', note: `${list.length} downloads started. If some are missing, allow multiple downloads in your browser.` })
  }

  async function downloadAll() {
    const list = downloadable
    if (!list.length) return
    type Writable = { write: (c: Uint8Array) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }
    const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<{ createWritable: () => Promise<Writable> }> }
    if (!w.showSaveFilePicker) return sequential(list)

    let writable: Writable
    try {
      const handle = await w.showSaveFilePicker({ suggestedName: `${slug(title)}.zip`, types: [{ description: 'Zip file', accept: { 'application/zip': ['.zip'] } }] })
      writable = await handle.createWritable()
    } catch {
      return // they closed the save window
    }
    const zipTotal = list.reduce((n, i) => n + i.size, 0)
    let bytes = 0
    try {
      const zip = new ZipWriter((chunk) => writable.write(chunk))
      for (let i = 0; i < list.length; i++) {
        setDl({ state: 'zipping', done: i, total: list.length, bytes, totalBytes: zipTotal })
        let body: ReadableStream<Uint8Array>
        if (isServedByBrandOS(list[i].full!)) {
          // fetched piece by piece, so even a huge video never runs into a time limit
          body = rangedStream(list[i].full!, list[i].size)
        } else {
          const res = await fetch(list[i].full!)
          if (!res.ok || !res.body) throw new Error(`Could not read ${list[i].name}`)
          body = res.body
        }
        await zip.addFile(list[i].name, body, (n) => {
          bytes += n
          setDl({ state: 'zipping', done: i, total: list.length, bytes, totalBytes: zipTotal })
        })
        setDl({ state: 'zipping', done: i + 1, total: list.length, bytes, totalBytes: zipTotal })
      }
      await zip.finish()
      await writable.close()
      setDl({ state: 'finished', note: 'Your zip file is saved.' })
    } catch (e) {
      try { await writable.abort?.() } catch {}
      setDl({ state: 'error', message: `${(e as Error).message || 'The download stopped.'} You can still download files one by one.` })
    }
  }

  // Big files from Google Drive are saved to disk in pieces (Chrome, Edge); everything else is a normal download.
  async function onDownloadClick(e: React.MouseEvent, it: ViewItem) {
    if (!it.full || !isServedByBrandOS(it.full) || it.size < 100 * 1024 * 1024 || !canSaveToDisk()) return
    e.preventDefault()
    let bytes = 0
    setDl({ state: 'single', name: it.name, bytes: 0, total: it.size })
    try {
      const saved = await saveLargeFile(it.full, it.size, it.name, (n) => {
        bytes += n
        setDl({ state: 'single', name: it.name, bytes, total: it.size })
      })
      setDl(saved ? { state: 'finished', note: `${it.name} is saved.` } : { state: 'idle' })
    } catch (err) {
      setDl({ state: 'error', message: `${(err as Error).message || 'The download stopped.'}` })
    }
  }

  const busy = dl.state === 'zipping' || dl.state === 'sequential' || dl.state === 'single'
  const cur = open !== null ? visible[open] : null
  const onCover = !!cover && coverStyle !== 'classic' && coverStyle !== 'split'

  const eyebrow = { color: 'inherit', opacity: 0.85 } as const
  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: 'smooth' })
  // Long titles (like a full event name) get a smaller size so they always fit nicely.
  const n = title.length
  const titleSize = (big: boolean) =>
    big ? (n <= 18 ? 'clamp(44px, 9vw, 112px)' : n <= 36 ? 'clamp(38px, 7vw, 84px)' : 'clamp(30px, 5.4vw, 66px)') : n <= 18 ? 'clamp(38px, 6.4vw, 84px)' : n <= 36 ? 'clamp(32px, 5.2vw, 64px)' : 'clamp(28px, 4.2vw, 52px)'
  const forLine = [preparedFor ? `Prepared for ${preparedFor}` : '', dateLabel].filter(Boolean).join('   ·   ')

  // The welcome: brand, title, subtitle, who it is for, and the thank-you message, all before the photos.
  const titleBlock = (big: boolean, light: boolean) => (
    <div className="g-rise" style={{ position: 'relative', textAlign: 'center', padding: '0 24px', color: light ? '#fff' : 'var(--g-fg)', maxWidth: 1000 }}>
      <div className="g-eyebrow g-rise" style={eyebrow}>{brand}</div>
      <div style={{ width: 1, height: big ? 48 : 32, background: 'currentColor', opacity: 0.5, margin: '22px auto' }} />
      <h1 className="g-serif g-rise d1" style={{ fontSize: titleSize(big), fontWeight: 500, lineHeight: 1.02, letterSpacing: '-0.01em', margin: 0, textWrap: 'balance' as const }}>{title}</h1>
      {subtitle && <div className="g-serif g-rise d2" style={{ fontSize: 'clamp(20px, 2.8vw, 32px)', fontStyle: 'italic', opacity: 0.92, marginTop: 14 }}>{subtitle}</div>}
      {forLine && <div className="g-eyebrow g-rise d2" style={{ ...eyebrow, marginTop: 26 }}>{forLine}</div>}
      {description && (
        <p className="g-serif g-rise d3" style={{ maxWidth: 620, margin: '28px auto 0', fontSize: 'clamp(18px, 2.1vw, 23px)', fontStyle: 'italic', lineHeight: 1.6, opacity: 0.92, whiteSpace: 'pre-wrap' }}>{description}</p>
      )}
      <div className="g-rise d3" style={{ marginTop: description ? 36 : 40 }}>
        <button className="g-link" onClick={scrollToGrid}>View gallery ↓</button>
      </div>
    </div>
  )

  const tile = (it: ViewItem, idx: number) => {
    const preview = it.thumb || it.display
    return (
      <div key={it.id} className="g-tile" style={{ aspectRatio: it.w && it.h ? `${it.w} / ${it.h}` : preview ? undefined : '4 / 3' }}>
        <button
          onClick={() => setOpen(idx)}
          aria-label={`Open ${it.name}`}
          style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in', color: 'inherit' }}
        >
          {preview ? (
            <Pic src={preview} alt={it.name} />
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 140, fontSize: 12, letterSpacing: '.08em', color: 'var(--g-muted)', padding: 12, textAlign: 'center', wordBreak: 'break-all' }}>{it.kind === 'video' ? '▶ VIDEO' : it.name}</span>
          )}
          {it.kind === 'video' && preview && (
            <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 54, height: 54, borderRadius: 27, background: 'rgba(20,20,20,.5)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, paddingLeft: 3 }}>▶</span>
          )}
        </button>
        {allowDownload && it.full && (
          <a className="g-dl" href={downloadUrlOf(it.full)} download={it.name} onClick={(e) => onDownloadClick(e, it)} aria-label={`Download ${it.name}`} title="Download" style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(20,20,20,.55)', backdropFilter: 'blur(6px)', color: '#fff', borderRadius: 18, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>↓</a>
        )}
      </div>
    )
  }

  return (
    <div className="g-root" style={themeVars(theme)}>
      <style dangerouslySetInnerHTML={{ __html: GALLERY_CSS }} />

      {/* ---------- Cover ---------- */}
      {coverStyle === 'split' ? (
        <header className="g-split">
          <div className="g-split-text" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>{titleBlock(false, false)}</div>
          <div className="g-split-img" style={{ position: 'relative', overflow: 'hidden', background: 'var(--g-card)' }}>
            {cover && <img className="g-kb" src={cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
        </header>
      ) : coverStyle === 'classic' ? (
        <header style={{ padding: 'clamp(48px, 9vw, 110px) 20px 32px', textAlign: 'center' }}>
          {titleBlock(false, false)}
          {cover && (
            <div className="g-fade" style={{ maxWidth: 1180, margin: '40px auto 0', aspectRatio: '16 / 9', overflow: 'hidden', background: 'var(--g-card)', borderRadius: 3 }}>
              <img className="g-kb" src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
        </header>
      ) : (
        <header style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--g-card)', padding: '72px 0' }}>
          {cover && (
            <>
              <img className="g-kb" src={cover} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,.28), rgba(0,0,0,.55))' }} />
            </>
          )}
          {titleBlock(true, onCover)}
        </header>
      )}

      {/* ---------- Sticky bar ---------- */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--g-bar)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid var(--g-line)' }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div className="g-serif" style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '46vw' }}>{title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--g-muted)', letterSpacing: '.06em' }}>{items.length} item{items.length === 1 ? '' : 's'} · {formatBytes(totalBytes)}</div>
          </div>
          {photos > 0 && videos > 0 && (
            <div style={{ display: 'flex', gap: 14 }} role="tablist">
              {([['all', `All`], ['image', `Photos ${photos}`], ['video', `Videos ${videos}`]] as [Filter, string][]).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={filter === k} className={`g-tab${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
              ))}
            </div>
          )}
          {downloadable.length > 0 && (
            <button className="g-btn" onClick={downloadAll} disabled={busy}>
              {busy ? 'Downloading…' : `Download all · ${formatBytes(downloadable.reduce((n, i) => n + i.size, 0))}`}
            </button>
          )}
        </div>
      </div>

      {/* ---------- Grid ---------- */}
      <main ref={gridRef} style={{ maxWidth: 1600, margin: '0 auto', padding: '40px 14px 90px', scrollMarginTop: 60 }}>
        {visible.length === 0 ? (
          <div className="g-serif" style={{ textAlign: 'center', color: 'var(--g-muted)', padding: '70px 0', fontSize: 26, fontStyle: 'italic' }}>Your photos are on their way.</div>
        ) : (
          <div ref={colsRef} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visible.map((it, idx) => (idx % cols === c ? tile(it, idx) : null))}
              </div>
            ))}
          </div>
        )}
        <footer style={{ textAlign: 'center', marginTop: 90 }}>
          <div className="g-eyebrow" style={{ color: 'var(--g-muted)' }}>Delivered by {brand}</div>
          <div style={{ fontSize: 11.5, color: 'var(--g-muted)', opacity: 0.7, marginTop: 8 }}>
            Made with Brand OS · <a href="/privacy" style={{ textDecoration: 'underline' }}>Privacy</a> · <a href="/terms" style={{ textDecoration: 'underline' }}>Terms</a>
          </div>
        </footer>
      </main>

      {/* ---------- Download progress ---------- */}
      {dl.state !== 'idle' && (
        <div role="status" className="g-fade" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)', zIndex: 60, background: 'var(--g-fg)', color: 'var(--g-bg)', borderRadius: 14, padding: '12px 18px', fontSize: 13, width: 'min(92vw, 440px)', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
          {dl.state === 'zipping' && (
            <>
              <div style={{ marginBottom: 8 }}>Saving your zip: file {Math.min(dl.done + 1, dl.total)} of {dl.total} · {formatBytes(dl.bytes)} of {formatBytes(dl.totalBytes)}. Keep this page open.</div>
              <div style={{ height: 3, background: 'color-mix(in srgb, var(--g-bg) 25%, transparent)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${dl.totalBytes ? Math.min(100, (dl.bytes / dl.totalBytes) * 100) : 0}%`, height: '100%', background: 'var(--g-bg)', transition: 'width .3s' }} />
              </div>
            </>
          )}
          {dl.state === 'single' && (
            <>
              <div style={{ marginBottom: 8 }}>Saving {dl.name}: {formatBytes(dl.bytes)} of {formatBytes(dl.total)}. Keep this page open.</div>
              <div style={{ height: 3, background: 'color-mix(in srgb, var(--g-bg) 25%, transparent)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${dl.total ? Math.min(100, (dl.bytes / dl.total) * 100) : 0}%`, height: '100%', background: 'var(--g-bg)', transition: 'width .3s' }} />
              </div>
            </>
          )}
          {dl.state === 'sequential' && <div>Starting download {dl.done + 1} of {dl.total}… your browser will save them one by one.</div>}
          {dl.state === 'finished' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{dl.note}</span><button className="g-link" onClick={() => setDl({ state: 'idle' })}>OK</button></div>
          )}
          {dl.state === 'error' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{dl.message}</span><button className="g-link" onClick={() => setDl({ state: 'idle' })}>OK</button></div>
          )}
        </div>
      )}

      {/* ---------- Full-screen viewer ---------- */}
      {cur && open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={cur.name}
          className="g-fade"
          onClick={() => setOpen(null)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            touchX.current = null
            if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--g-lb)', color: 'var(--g-fg)', display: 'flex', flexDirection: 'column' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', gap: 12, fontSize: 12.5, letterSpacing: '.06em' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{open + 1} / {visible.length} <span style={{ color: 'var(--g-muted)', marginLeft: 8 }}>{cur.name}</span></span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
              {allowDownload && cur.full && <a href={downloadUrlOf(cur.full)} download={cur.name} onClick={(e) => onDownloadClick(e, cur)} style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', padding: '8px 12px', borderRadius: 999, border: '1px solid var(--g-line)' }}>Download · {formatBytes(cur.size)}</a>}
              <button className="g-iconbtn" onClick={() => setOpen(null)} aria-label="Close">×</button>
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 56px' }}>
            <button className="g-iconbtn" onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Previous" style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)' }}>‹</button>
            <button className="g-iconbtn" onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Next" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}>›</button>
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {cur.kind === 'video' && cur.full ? (
                <video key={cur.id} className="g-fade" src={cur.full} poster={cur.thumb ?? undefined} controls autoPlay playsInline style={{ maxWidth: '100%', maxHeight: 'calc(100svh - 170px)', borderRadius: 3, background: '#000' }} />
              ) : cur.display || cur.thumb ? (
                <img key={cur.id} className="g-fade" src={cur.display || cur.thumb || ''} alt={cur.name} style={{ maxWidth: '100%', maxHeight: 'calc(100svh - 170px)', objectFit: 'contain', borderRadius: 2, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--g-muted)' }}>No preview for this file.{allowDownload && cur.full && <> <a href={downloadUrlOf(cur.full)} download={cur.name} style={{ color: 'var(--g-fg)', textDecoration: 'underline' }}>Download it</a>.</>}</div>
              )}
            </div>
          </div>

          {/* filmstrip */}
          <div onClick={(e) => e.stopPropagation()} className="g-strip" style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '10px 12px 14px', overflowX: 'auto' }}>
            {visible.map((it, idx) => ({ it, idx })).filter(({ idx }) => Math.abs(idx - open) <= 8).map(({ it, idx }) => (
              <button key={it.id} onClick={() => setOpen(idx)} aria-label={`Go to ${it.name}`} style={{ flexShrink: 0, width: 54, height: 54, padding: 0, borderRadius: 3, overflow: 'hidden', border: 'none', background: 'var(--g-card)', opacity: idx === open ? 1 : 0.45, outline: idx === open ? '1.5px solid var(--g-fg)' : 'none', outlineOffset: 2, cursor: 'pointer', transition: 'opacity .2s' }}>
                {(it.thumb || it.display) && <img src={(it.thumb || it.display)!} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
