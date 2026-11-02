'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadUrlOf, formatBytes, isServedByBrandOS } from '@/lib/galleryFormat'
import { canSaveToDisk, saveLargeFile } from '@/lib/rangedFetch'
import { GALLERY_CSS, themeVars } from '@/lib/galleryTheme'
import type { ViewItem } from './GalleryView'

// A delivery that is one film (plus, optionally, extra cuts and files). It uses the same storage, passcode,
// expiry and download rules as a photo gallery; only the page the client sees is different.

const stripExt = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, '')

// The opening: the brand name and the title appear on a calm screen, then it fades away on its own (CSS only, so it can
// never get stuck), or sooner if the client taps. It plays once per visit.
const INTRO_CSS = `
.vd-intro{position:fixed;inset:0;z-index:2000;background:var(--g-bg);color:var(--g-fg);display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;cursor:pointer;animation:vd-out .8s ease 3s forwards}
.vd-brand{font-size:clamp(34px,8vw,78px);font-weight:500;letter-spacing:.02em;line-height:1.05;animation:vd-in 1.3s cubic-bezier(.2,.7,.2,1) .25s both}
.vd-line{width:1px;height:56px;background:currentColor;opacity:.5;margin:24px auto;transform-origin:top;animation:vd-grow .9s ease .9s both}
.vd-sub{font-size:clamp(17px,2.4vw,26px);font-style:italic;opacity:.9;max-width:640px;animation:vd-in 1s ease 1.5s both}
@keyframes vd-in{from{opacity:0;transform:translateY(14px) scale(.98);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes vd-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes vd-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){.vd-intro{display:none}}
`

type Note = { kind: 'progress'; name: string; bytes: number; total: number } | { kind: 'done'; text: string } | { kind: 'error'; text: string }

export default function VideoDelivery({
  title, brand, subtitle, preparedFor, description, dateLabel, allowDownload, theme, featuredId, introKey, items,
}: {
  title: string
  brand: string
  subtitle: string | null
  preparedFor: string | null
  description: string | null
  dateLabel: string
  allowDownload: boolean
  theme: string
  featuredId: string | null
  introKey: string
  items: ViewItem[]
}) {
  // The main film is the one picked as the gallery's cover (if it is a video), otherwise the first by file name.
  const videos = useMemo(() => {
    const list = items
      .filter((i) => i.kind === 'video' && i.full)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    const at = list.findIndex((i) => i.id === featuredId)
    if (at > 0) list.unshift(...list.splice(at, 1))
    return list
  }, [items, featuredId])
  const extras = useMemo(
    () => (allowDownload ? items.filter((i) => i.kind !== 'video' && i.full).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : []),
    [items, allowDownload],
  )

  const [currentId, setCurrentId] = useState<string | null>(videos[0]?.id ?? null)
  const [note, setNote] = useState<Note | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const [introOff, setIntroOff] = useState(false)
  // Someone who already saw the opening in this visit (a reload, or coming back) goes straight to the film.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`vd_intro_${introKey}`)) setIntroOff(true)
      else sessionStorage.setItem(`vd_intro_${introKey}`, '1')
    } catch {}
  }, [introKey])
  const cur = videos.find((v) => v.id === currentId) ?? videos[0] ?? null
  const vertical = !!cur && !!cur.w && !!cur.h && cur.h > cur.w * 1.05
  const forLine = [preparedFor ? `Prepared for ${preparedFor}` : '', dateLabel].filter(Boolean).join('   ·   ')
  const n = title.length
  const titleSize = n <= 18 ? 'clamp(38px, 6.4vw, 84px)' : n <= 36 ? 'clamp(32px, 5vw, 62px)' : 'clamp(27px, 4vw, 50px)'

  // Very large files are saved to disk in pieces (Chrome, Edge); everything else is a normal download.
  async function onDownloadClick(e: React.MouseEvent, it: ViewItem) {
    if (!it.full || !isServedByBrandOS(it.full) || it.size < 100 * 1024 * 1024 || !canSaveToDisk()) return
    e.preventDefault()
    let bytes = 0
    setNote({ kind: 'progress', name: it.name, bytes: 0, total: it.size })
    try {
      const saved = await saveLargeFile(it.full, it.size, it.name, (b) => {
        bytes += b
        setNote({ kind: 'progress', name: it.name, bytes, total: it.size })
      })
      setNote(saved ? { kind: 'done', text: `${it.name} is saved.` } : null)
    } catch (err) {
      setNote({ kind: 'error', text: (err as Error).message || 'The download stopped.' })
    }
  }

  const choose = (id: string) => {
    setCurrentId(id)
    playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="g-root" style={themeVars(theme)}>
      <style dangerouslySetInnerHTML={{ __html: GALLERY_CSS + INTRO_CSS }} />

      {!introOff && (
        <div className="vd-intro" onClick={() => setIntroOff(true)} aria-hidden="true">
          <div>
            <div className="g-serif vd-brand">{brand}</div>
            <div className="vd-line" />
            <div className="g-serif vd-sub">{title}</div>
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: 'clamp(40px, 7vw, 88px) 20px 64px' }}>
        {/* ---------- Title ---------- */}
        <header className="g-rise" style={{ textAlign: 'center', marginBottom: 'clamp(28px, 4vw, 48px)' }}>
          <div className="g-eyebrow" style={{ color: 'var(--g-muted)' }}>{brand}</div>
          <div style={{ width: 1, height: 34, background: 'var(--g-fg)', opacity: 0.4, margin: '20px auto' }} />
          <h1 className="g-serif" style={{ fontSize: titleSize, fontWeight: 500, lineHeight: 1.04, letterSpacing: '-0.01em', margin: 0, textWrap: 'balance' as const }}>{title}</h1>
          {subtitle && <div className="g-serif" style={{ fontSize: 'clamp(19px, 2.4vw, 28px)', fontStyle: 'italic', opacity: 0.9, marginTop: 14 }}>{subtitle}</div>}
          {forLine && <div className="g-eyebrow" style={{ color: 'var(--g-muted)', marginTop: 22 }}>{forLine}</div>}
        </header>

        {/* ---------- The film ---------- */}
        {cur ? (
          <>
            <div ref={playerRef} className="g-rise d1" style={{ scrollMarginTop: 24 }}>
              <div style={{ width: '100%', maxWidth: vertical ? 'min(420px, 100%)' : 1180, margin: '0 auto', background: '#000', borderRadius: 4, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
                <video
                  key={cur.id}
                  src={cur.full ?? undefined}
                  poster={cur.thumb ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList={allowDownload ? undefined : 'nodownload'}
                  style={{ display: 'block', width: '100%', maxHeight: '78svh', aspectRatio: cur.w && cur.h ? `${cur.w} / ${cur.h}` : '16 / 9', objectFit: 'contain', background: '#000' }}
                />
              </div>

              <div style={{ maxWidth: vertical ? 'min(420px, 100%)' : 1180, margin: '18px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="g-serif" style={{ fontSize: 22, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{videos.length > 1 ? stripExt(cur.name) : title}</div>
                  <div style={{ fontSize: 12, color: 'var(--g-muted)', letterSpacing: '.06em' }}>{formatBytes(cur.size)}{allowDownload ? ' · full quality original' : ''}</div>
                </div>
                {allowDownload && cur.full && (
                  <a className="g-btn" href={downloadUrlOf(cur.full)} download={cur.name} onClick={(e) => onDownloadClick(e, cur)} style={{ display: 'inline-block', textDecoration: 'none' }}>
                    Download video
                  </a>
                )}
              </div>
            </div>

            {description && (
              <p className="g-serif g-rise d2" style={{ maxWidth: 640, margin: 'clamp(36px, 5vw, 60px) auto 0', textAlign: 'center', fontSize: 'clamp(18px, 2.1vw, 23px)', fontStyle: 'italic', lineHeight: 1.6, opacity: 0.94, whiteSpace: 'pre-wrap' }}>{description}</p>
            )}

            {/* ---------- Other cuts ---------- */}
            {videos.length > 1 && (
              <section style={{ maxWidth: 1180, margin: '64px auto 0' }}>
                <h2 className="g-serif" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 500, margin: '0 0 16px' }}>
                  More from this delivery <span style={{ fontSize: 13, color: 'var(--g-muted)', fontFamily: 'inherit', letterSpacing: '.1em' }}>{videos.length}</span>
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 14 }}>
                  {videos.map((v) => {
                    const on = v.id === cur.id
                    return (
                      <button key={v.id} onClick={() => choose(v.id)} aria-label={`Play ${stripExt(v.name)}`} aria-pressed={on} style={{ textAlign: 'left', padding: 0, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', opacity: on ? 1 : 0.8 }}>
                        <span className="g-tile" style={{ display: 'block', aspectRatio: '16 / 9', outline: on ? '1.5px solid var(--g-fg)' : 'none', outlineOffset: 3 }}>
                          {v.thumb && <img src={v.thumb} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 1 }} />}
                          <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 46, height: 46, borderRadius: 23, background: 'rgba(20,20,20,.55)', border: '1px solid rgba(255,255,255,.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, paddingLeft: 3 }}>▶</span>
                        </span>
                        <span style={{ display: 'block', marginTop: 8, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stripExt(v.name)}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--g-muted)' }}>{formatBytes(v.size)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ---------- Extra files ---------- */}
            {extras.length > 0 && (
              <section style={{ maxWidth: 1180, margin: '56px auto 0' }}>
                <h2 className="g-serif" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 500, margin: '0 0 8px' }}>Files</h2>
                <div>
                  {extras.map((f) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderTop: '1px solid var(--g-line)' }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{f.name} <span style={{ color: 'var(--g-muted)', fontSize: 12, marginLeft: 6 }}>{formatBytes(f.size)}</span></span>
                      <a className="g-link" href={downloadUrlOf(f.full!)} download={f.name} onClick={(e) => onDownloadClick(e, f)} style={{ flexShrink: 0 }}>Download</a>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="g-serif" style={{ textAlign: 'center', color: 'var(--g-muted)', padding: '70px 0', fontSize: 26, fontStyle: 'italic' }}>Your video is on its way.</div>
        )}

        <footer style={{ textAlign: 'center', marginTop: 90 }}>
          <div className="g-eyebrow" style={{ color: 'var(--g-muted)' }}>Delivered by {brand}</div>
          <div style={{ fontSize: 11.5, color: 'var(--g-muted)', opacity: 0.7, marginTop: 8 }}>
            Made with Brand Console · <a href="/privacy" style={{ textDecoration: 'underline' }}>Privacy</a> · <a href="/terms" style={{ textDecoration: 'underline' }}>Terms</a>
          </div>
        </footer>
      </main>

      {/* ---------- Download progress ---------- */}
      {note && (
        <div role="status" className="g-fade" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)', zIndex: 1100, background: 'var(--g-fg)', color: 'var(--g-bg)', borderRadius: 14, padding: '12px 18px', fontSize: 13, width: 'min(92vw, 440px)', boxShadow: '0 12px 40px rgba(0,0,0,.25)' }}>
          {note.kind === 'progress' ? (
            <>
              <div style={{ marginBottom: 8 }}>Saving {note.name}: {formatBytes(note.bytes)} of {formatBytes(note.total)}. Keep this page open.</div>
              <div style={{ height: 3, background: 'color-mix(in srgb, var(--g-bg) 25%, transparent)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${note.total ? Math.min(100, (note.bytes / note.total) * 100) : 0}%`, height: '100%', background: 'var(--g-bg)', transition: 'width .3s' }} />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{note.text}</span>
              <button className="g-link" onClick={() => setNote(null)}>OK</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
