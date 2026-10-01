import { getEmbed } from '@/lib/embed'

// Shows a deliverable link the best way it can: video player, image, or an "open" button.
export default function DeliverablePreview({ url }: { url: string }) {
  const e = getEmbed(url)

  if (e.kind === 'youtube' || e.kind === 'vimeo') {
    return (
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
        <iframe
          src={e.src}
          title="Video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
    )
  }
  if (e.kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={e.src} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
  }
  return (
    <a href={e.src} target="_blank" rel="noreferrer" className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>
        <span style={{ display: 'block', fontWeight: 600 }}>Open the file</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e.host}</span>
      </span>
      <span aria-hidden="true">↗</span>
    </a>
  )
}
