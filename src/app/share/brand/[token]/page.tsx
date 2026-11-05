import Link from 'next/link'
import { notFound } from 'next/navigation'
import ThemeToggle from '@/components/ThemeToggle'
import { db } from '@/lib/db'

const SERIF = "Georgia, 'Times New Roman', serif"

function kitContent(json: unknown) {
  const o = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  return {
    bio: typeof o.bio === 'string' ? o.bio : '',
    tagline: typeof o.tagline === 'string' ? o.tagline : '',
    profilePicture: typeof o.profilePicture === 'string' ? o.profilePicture : '',
    highlights: Array.isArray(o.highlights) ? o.highlights.filter((h): h is string => typeof h === 'string') : [],
  }
}

// Public, view-only brand guide for a brand whose owner chose to share it.
export default async function SharedBrandPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const brand = await db.brandSpace
    .findUnique({
      where: { shareToken: params.token },
      include: { brandProfile: true, brandKitItems: { where: { type: 'platform_kit', isSelected: true } } },
    })
    .catch(() => null)
  if (!brand) notFound()

  const profile = brand.brandProfile
  const sections = [
    { title: 'Positioning', text: profile?.positioningSummary },
    { title: 'Voice', text: profile?.voiceSummary },
    { title: 'Audience', text: profile?.audienceSummary },
  ].filter((s) => s.text)
  const kits = brand.brandKitItems.map((i) => ({ platform: i.platform ?? 'Platform', ...kitContent(i.contentJson) }))
  const empty = sections.length === 0 && kits.length === 0

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><ThemeToggle /></div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Brand guide</div>
      <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 600, margin: '0 0 28px' }}>{brand.name}</h1>

      {empty && <div className="card-empty">This brand guide is still being put together. Check back soon.</div>}

      {sections.map((s) => (
        <section key={s.title} style={{ marginBottom: 26 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>{s.title}</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap' }}>{s.text}</p>
        </section>
      ))}

      {kits.length > 0 && (
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}>Platforms</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
            {kits.map((k, i) => (
              <div key={i} className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{k.platform}</div>
                {k.tagline && <div style={{ fontFamily: SERIF, fontSize: 15, marginBottom: 8 }}>{k.tagline}</div>}
                {k.bio && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{k.bio}</div>}
                {k.highlights.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Highlights: {k.highlights.join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 40 }}>
        View only · Made with <Link href="/" style={{ color: 'var(--accent-text)' }}>Brand Console</Link>
      </div>
    </main>
  )
}
