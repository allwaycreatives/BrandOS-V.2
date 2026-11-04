'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { downloadUrlOf, formatBytes, isServedByBrandOS } from '@/lib/galleryFormat'
import { canSaveToDisk, saveLargeFile } from '@/lib/rangedFetch'
import { GALLERY_CSS, themeVars } from '@/lib/galleryTheme'
import type { ViewItem } from './GalleryView'

// A delivery that is one film (plus, optionally, extra cuts and files). It uses the same storage, passcode,
// expiry and download rules as a photo gallery; only the page the client sees is different.

const stripExt = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, '')

// The opening: the Brand Console logo animation (the orange B slides in, then the rest of the logo is written across),
// then "Delivered by <brand>". Pure CSS with a fail-safe, so it can never get stuck: it fades away on its own after a few
// seconds, or sooner if the client taps. It plays once per visit and is off for people who prefer reduced motion.
const INTRO_CSS = `
.vd-intro{position:fixed;inset:0;z-index:2000;background:var(--g-bg);color:var(--g-fg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;padding:24px;cursor:pointer;animation:vd-out .7s ease 3.4s forwards}
.vd-mark{position:relative;width:min(78vw,520px);aspect-ratio:1052/324;animation:vd-markin 2.6s cubic-bezier(.2,.7,.2,1) both}
.vd-mark img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none;-webkit-user-drag:none}
.vd-b{animation:vd-brandin .9s cubic-bezier(.2,.8,.2,1) both}
.vd-c{-webkit-mask-image:linear-gradient(90deg,#000 0%,#000 33.3%,transparent 66.6%,transparent 100%);mask-image:linear-gradient(90deg,#000 0%,#000 33.3%,transparent 66.6%,transparent 100%);-webkit-mask-size:300% 100%;mask-size:300% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;animation:vd-consolein 1.5s cubic-bezier(.45,.05,.25,1) .55s both}
.vd-by{font-size:11.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--g-muted);text-align:center;animation:vd-byin .7s ease 1.95s both}
@keyframes vd-brandin{from{opacity:0;transform:translateX(-4%) skewX(-6deg);clip-path:inset(0 100% 0 0)}to{opacity:1;transform:none;clip-path:inset(0 0 0 0)}}
@keyframes vd-consolein{from{-webkit-mask-position:100% 0;mask-position:100% 0}to{-webkit-mask-position:0% 0;mask-position:0% 0}}
@keyframes vd-markin{from{transform:scale(.96)}to{transform:scale(1)}}
@keyframes vd-byin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes vd-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){.vd-intro{display:none}}
`

// After a video fails, ask the server directly what it says, so the message can name the real cause.
async function probe(src: string): Promise<string> {
  try {
    const res = await fetch(src, { headers: { Range: 'bytes=0-1' }, cache: 'no-store' })
    if (res.ok) {
      const range = res.headers.get('content-range')
      res.body?.cancel().catch(() => {})
      return `Server replied ${res.status}, ${res.headers.get('content-type') || 'no type'}${range ? `, ${range}` : ''}`
    }
    return `Server replied ${res.status}: ${(await res.text()).replace(/\s+/g, ' ').slice(0, 160)}`
  } catch {
    return 'Could not reach the server.'
  }
}

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
  // The player takes the film's own shape (9:16, 16:9, 4:5, 1:1, 4:3 ...). The real size is read from the video itself
  // once it loads; until then the size saved at upload is used.
  const [dims, setDims] = useState<Record<string, { w: number; h: number }>>({})
  const [failed, setFailed] = useState<{ id: string; code: number | null; detail?: string } | null>(null)
  const dropRetries = useRef(0) // automatic retries after a dropped connection
  const [tries, setTries] = useState(0)
  const real = cur ? dims[cur.id] : undefined
  const ratio = real ? real.w / real.h : cur?.w && cur?.h ? cur.w / cur.h : 16 / 9
  // as wide as the page allows, but never taller than about 78% of the screen
  const playerW = `min(100%, 1180px, calc(78svh * ${ratio.toFixed(4)}))`
  const barW = `max(min(100%, 420px), ${playerW})`
  // the sender's Google Drive connection is the problem (not the viewer's browser): say so plainly, and do not offer a download that would fail too
  const driveProblem = /reconnected|Google said (401|403)|does not accept/i.test(failed?.detail || '')

  // Original quality plays first. If a "smooth" (watch) version exists and the original stalls for a few seconds,
  // we switch to the smooth one at the same moment of the film. The viewer can also switch by hand.
  const videoRef = useRef<HTMLVideoElement>(null)
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resume = useRef<{ t: number; play: boolean } | null>(null)
  const [light, setLight] = useState<Record<string, boolean>>({})
  const [rememberedLight, setRememberedLight] = useState(false) // already switched earlier in this visit
  const [autoSwitched, setAutoSwitched] = useState(false)
  // Which address to use: straight from Google Drive when the delivery allows it, or the route through Brand Console
  // (the fallback, used after the direct one fails).
  const [proxied, setProxied] = useState<Record<string, boolean>>({})
  // Last resort: Google's own player, shown inside this page. It plays whatever Google can play, with its own quality switching.
  const [embedded, setEmbedded] = useState<Record<string, boolean>>({})
  const useEmbed = !!cur && !!cur.embed && !!embedded[cur.id]
  const pick = (it: ViewItem, key: 'full' | 'display' | 'thumb') => (proxied[it.id] && it.fallback ? it.fallback[key] : it[key])
  const dlHref = (it: ViewItem) => {
    const u = pick(it, 'full') as string
    return isServedByBrandOS(u) ? downloadUrlOf(u) : u // a direct Google address already downloads by itself
  }
  const hasLight = !!cur && !!pick(cur, 'display') && pick(cur, 'display') !== pick(cur, 'full')
  const useLight = !!cur && hasLight && (light[cur.id] ?? rememberedLight)
  const clearStall = () => {
    if (stallTimer.current) clearTimeout(stallTimer.current)
    stallTimer.current = null
  }
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`vd_light_${introKey}`)) setRememberedLight(true)
    } catch {}
    return clearStall
  }, [introKey])
  function switchTo(toLight: boolean, auto: boolean) {
    if (!cur) return
    clearStall()
    const el = videoRef.current
    if (el) resume.current = { t: el.currentTime || 0, play: !el.paused }
    setLight((p) => ({ ...p, [cur.id]: toLight }))
    setAutoSwitched(auto && toLight)
    if (auto && toLight) {
      try {
        sessionStorage.setItem(`vd_light_${introKey}`, '1')
      } catch {}
    }
  }
  const forLine = [preparedFor ? `Prepared for ${preparedFor}` : '', dateLabel].filter(Boolean).join('   ·   ')
  const n = title.length
  const titleSize = n <= 18 ? 'clamp(38px, 6.4vw, 84px)' : n <= 36 ? 'clamp(32px, 5vw, 62px)' : 'clamp(27px, 4vw, 50px)'

  // Very large files are saved to disk in pieces (Chrome, Edge); everything else is a normal download.
  async function onDownloadClick(e: React.MouseEvent, it: ViewItem) {
    const url = pick(it, 'full')
    if (!url || !isServedByBrandOS(url) || it.size < 100 * 1024 * 1024 || !canSaveToDisk()) return
    e.preventDefault()
    let bytes = 0
    setNote({ kind: 'progress', name: it.name, bytes: 0, total: it.size })
    try {
      const saved = await saveLargeFile(url, it.size, it.name, (b) => {
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
          <div className="vd-mark">
            <img className="vd-b" src="/brand/full-b.png" alt="" draggable={false} />
            <img className="vd-c" src={theme === 'dark' ? '/brand/full-c-onDark.png' : '/brand/full-c-onLight.png'} alt="" draggable={false} />
          </div>
          <div className="vd-by">Delivered by {brand}</div>
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
              <div style={{ position: 'relative', width: playerW, aspectRatio: `${ratio}`, margin: '0 auto', background: '#000', borderRadius: 4, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
                {useEmbed ? (
                  <iframe key={`${cur.id}-embed`} src={cur.embed} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{ display: 'block', width: '100%', height: '100%', border: 0, background: '#000' }} />
                ) : (
                <video
                  key={`${cur.id}-${tries}`}
                  ref={videoRef}
                  src={(useLight ? pick(cur, 'display') : pick(cur, 'full')) ?? undefined}
                  poster={pick(cur, 'thumb') ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget
                    if (el.videoWidth && el.videoHeight) setDims((p) => (p[cur.id]?.w === el.videoWidth && p[cur.id]?.h === el.videoHeight ? p : { ...p, [cur.id]: { w: el.videoWidth, h: el.videoHeight } }))
                    setFailed(null)
                    // after a switch, carry on from the same moment
                    const r = resume.current
                    if (!r) return
                    resume.current = null
                    if (r.t > 0) el.currentTime = r.t
                    if (r.play) el.play().catch(() => {})
                  }}
                  onError={(e) => {
                    clearStall()
                    const el = e.currentTarget
                    const code = el.error?.code ?? null
                    // a connection that dropped mid-film: quietly try again from the same moment (up to 3 times)
                    if ((code === 2 || code === 3) && el.currentTime > 0 && dropRetries.current < 3) {
                      dropRetries.current += 1
                      resume.current = { t: el.currentTime, play: true }
                      setTries((t) => t + 1)
                      return
                    }
                    // streaming the file failed: show Google's own player instead (when this delivery's files are shared)
                    if (!embedded[cur.id] && cur.embed) {
                      setEmbedded((p) => ({ ...p, [cur.id]: true }))
                      setFailed(null)
                      return
                    }
                    // loaded straight from Google and it failed: use the route through Brand Console instead, from the same moment
                    if (!proxied[cur.id] && cur.fallback) {
                      resume.current = { t: el.currentTime || 0, play: true }
                      setProxied((p) => ({ ...p, [cur.id]: true }))
                      return
                    }
                    // the original cannot be loaded and there is a smooth version: use that instead
                    if (hasLight && !useLight) return switchTo(true, true)
                    const id = cur.id
                    setFailed({ id, code })
                    probe(el.currentSrc).then((detail) => setFailed((f) => (f && f.id === id ? { ...f, detail } : f)))
                  }}
                  onWaiting={(e) => {
                    if (!hasLight || useLight || stallTimer.current || e.currentTarget.seeking) return
                    stallTimer.current = setTimeout(() => {
                      stallTimer.current = null
                      switchTo(true, true)
                    }, 3500)
                  }}
                  onPlaying={() => {
                    clearStall()
                    dropRetries.current = 0
                  }}
                  onPause={clearStall}
                  onSeeking={clearStall}
                  onEnded={clearStall}
                  controlsList={allowDownload ? undefined : 'nodownload'}
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                />
                )}
                {failed?.id === cur.id && (
                  <div role="alert" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center', background: 'rgba(0,0,0,.82)', color: '#fff', fontSize: 14, lineHeight: 1.5 }}>
                    <div style={{ fontWeight: 600 }}>{driveProblem ? 'This video is temporarily unavailable.' : 'This video could not be played here.'}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.75, maxWidth: 360 }}>
                      {driveProblem ? 'The sender’s storage connection needs attention. Please let them know, and try again a little later.' : failed.code === 2 ? 'The connection dropped while it was loading.' : failed.code === 4 ? 'The browser could not open this file. It may be slow to start, or in a format this browser cannot play.' : 'Something went wrong while loading it.'} (code {failed.code ?? '?'})
                    </div>
                    {failed.detail && <div style={{ fontSize: 11.5, opacity: 0.6, maxWidth: 380, wordBreak: 'break-word' }}>{failed.detail}</div>}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button type="button" className="g-btn" onClick={() => { setFailed(null); setTries((t) => t + 1) }}>Try again</button>
                      {allowDownload && cur.full && !driveProblem && <a className="g-btn" href={dlHref(cur)} download={cur.name} style={{ textDecoration: 'none' }}>Download instead</a>}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ width: barW, margin: '18px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="g-serif" style={{ fontSize: 22, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{videos.length > 1 ? stripExt(cur.name) : title}</div>
                  <div style={{ fontSize: 12, color: 'var(--g-muted)', letterSpacing: '.06em' }}>{useEmbed ? `Playing in Google’s player${allowDownload ? ` · the download is the full-quality original (${formatBytes(cur.size)})` : ''}` : useLight ? `Playing the smooth version${allowDownload ? ` · the download is the full-quality original (${formatBytes(cur.size)})` : ''}` : `${formatBytes(cur.size)}${allowDownload ? ' · full quality original' : ''}`}</div>
                  {autoSwitched && useLight && <div style={{ fontSize: 12, color: 'var(--g-muted)', marginTop: 2 }}>Your connection looked slow, so we switched to a smoother version.</div>}
                </div>
                {allowDownload && cur.full && (
                  <a className="g-btn" href={dlHref(cur)} download={cur.name} onClick={(e) => onDownloadClick(e, cur)} style={{ display: 'inline-block', textDecoration: 'none' }}>
                    Download video
                  </a>
                )}
              </div>
              {hasLight && !useEmbed && (
                <div style={{ width: barW, margin: '12px auto 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--g-muted)', letterSpacing: '.06em' }}>
                  <span>Quality</span>
                  {[{ label: 'Original', to: false }, { label: 'Smooth', to: true }].map((o) => (
                    <button key={o.label} type="button" onClick={() => !(o.to === useLight) && switchTo(o.to, false)} aria-pressed={o.to === useLight} style={{ border: '1px solid var(--g-line)', borderRadius: 999, padding: '3px 12px', background: o.to === useLight ? 'var(--g-fg)' : 'transparent', color: o.to === useLight ? 'var(--g-bg)' : 'inherit', cursor: 'pointer', font: 'inherit' }}>{o.label}</button>
                  ))}
                </div>
              )}
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
                      <a className="g-link" href={dlHref(f)} download={f.name} onClick={(e) => onDownloadClick(e, f)} style={{ flexShrink: 0 }}>Download</a>
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
