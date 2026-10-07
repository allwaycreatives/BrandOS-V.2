import { getEmbed, isVerticalPost } from '@/lib/embed'

// Shows a post's video the way it will really look: a 9:16 phone shape for Reels/TikTok/Shorts, wide for the rest.
// Video plays from its own host (Drive, YouTube, Vimeo), so quality follows the viewer's connection.
export default function PostPlayer({ url, platform, thumbnailUrl }: { url: string | null; platform: string; thumbnailUrl: string | null }) {
  const vertical = isVerticalPost(platform, url || '')
  const frame: React.CSSProperties = {
    width: '100%',
    maxWidth: vertical ? 320 : 640,
    aspectRatio: vertical ? '9 / 16' : '16 / 9',
    borderRadius: 14,
    overflow: 'hidden',
    background: '#000',
    border: '1px solid var(--border-strong)',
    margin: '0 auto',
    position: 'relative',
  }

  if (!url) {
    return thumbnailUrl ? (
      <div style={frame}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    ) : (
      <div style={{ ...frame, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13, textAlign: 'center', padding: 16 }}>The video has not been attached yet.</div>
    )
  }

  const e = getEmbed(url)
  if (e.kind === 'youtube' || e.kind === 'vimeo' || e.kind === 'drive') {
    return (
      <div style={frame}>
        <iframe src={e.src} title="Post video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
      </div>
    )
  }
  if (e.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: 640, margin: '0 auto', borderRadius: 14, border: '1px solid var(--border-strong)' }} />
  }
  return (
    <div style={{ ...frame, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, color: '#ddd', fontSize: 13, textAlign: 'center' }}>
      <div>This file opens on {e.host}.</div>
      <a href={url} target="_blank" rel="noreferrer"><button type="button" className="primary">Open it ↗</button></a>
    </div>
  )
}
