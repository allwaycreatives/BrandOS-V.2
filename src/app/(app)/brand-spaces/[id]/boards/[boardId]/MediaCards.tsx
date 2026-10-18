'use client'

// Audio, video and map cards. Clips and maps only react to the mouse once the card is selected,
// so a click on the board never accidentally starts playing something while you are dragging.

export type VideoSource = { kind: 'iframe' | 'file'; src: string }

// YouTube and Vimeo links become embedded players; direct video files play natively. Anything else is not a video we can play.
export function videoSource(raw: string): VideoSource | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1]
    return id ? { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = u.pathname.split('/').filter(Boolean)
    const id = u.searchParams.get('v') || (['shorts', 'embed', 'live', 'v'].includes(parts[0]) ? parts[1] : '')
    return id ? { kind: 'iframe', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` } : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).find((p) => /^\d+$/.test(p))
    return id ? { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` } : null
  }
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(u.pathname)) return { kind: 'file', src: raw }
  return null
}

export function mapSource(query: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
}

// Uploaded clips are stored as "url" + newline + "file name".
export function splitMedia(content: string) {
  const i = content.indexOf('\n')
  return i < 0 ? { url: content, name: '' } : { url: content.slice(0, i), name: content.slice(i + 1) }
}

const caption: React.CSSProperties = { fontSize: 11.5, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

export function AudioCard({ content, interactive }: { content: string; interactive: boolean }) {
  const { url, name } = splitMedia(content)
  return (
    <div style={{ color: '#1a1a1a' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ flex: '0 0 auto' }}><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></svg>
        <div style={{ ...caption, fontSize: 12.5, fontWeight: 600, color: '#1a1a1a' }}>{name || 'Audio'}</div>
      </div>
      <audio controls preload="metadata" src={url} style={{ width: '100%', height: 36, display: 'block', pointerEvents: interactive ? 'auto' : 'none' }} />
    </div>
  )
}

export function VideoCard({ content, interactive }: { content: string; interactive: boolean }) {
  const { url, name } = splitMedia(content)
  const src = videoSource(url)
  const frame: React.CSSProperties = { display: 'block', width: '100%', aspectRatio: '16 / 9', border: 'none', background: '#000', borderRadius: 4, pointerEvents: interactive ? 'auto' : 'none' }
  return (
    <div>
      {src?.kind === 'iframe' ? (
        <iframe src={src.src} title={name || 'Video'} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen style={frame} />
      ) : (
        <video controls preload="metadata" src={src?.src ?? url} style={{ ...frame, objectFit: 'contain' }} />
      )}
      {name && <div style={{ ...caption, padding: '6px 4px 2px' }}>{name}</div>}
    </div>
  )
}

export function MapCard({ content, interactive }: { content: string; interactive: boolean }) {
  return (
    <div>
      <iframe src={mapSource(content)} title={`Map of ${content}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ display: 'block', width: '100%', aspectRatio: '4 / 3', border: 'none', borderRadius: 4, background: '#e9e9e9', pointerEvents: interactive ? 'auto' : 'none' }} />
      <div style={{ ...caption, padding: '6px 4px 2px', color: '#1a1a1a', fontWeight: 600 }}>{content}</div>
    </div>
  )
}
