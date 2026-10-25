import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { unlockCookieName, unlockCookieValue } from '@/lib/gallery'
import { naturalSort } from '@/lib/galleryFormat'
import { GALLERY_CSS, themeVars } from '@/lib/galleryTheme'
import PasscodeForm from './PasscodeForm'
import GalleryView, { type ViewItem } from './GalleryView'

export const dynamic = 'force-dynamic'

const lookup = (token: string) =>
  db.gallery.findUnique({ where: { shareToken: token }, include: { items: true, brandSpace: { select: { name: true } } } }).catch(() => null)

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const g = await lookup(params.token)
  if (!g || !g.published) return { title: 'Gallery' }
  const cover = g.items.find((i) => i.id === g.coverItemId) ?? g.items.find((i) => i.thumbUrl)
  const image = cover?.thumbUrl || undefined
  // The title is shown when the link is shared; the pictures stay behind the passcode if there is one.
  return { title: `${g.title} · ${g.brandSpace.name}`, robots: { index: false, follow: false }, openGraph: { title: g.title, description: `A gallery from ${g.brandSpace.name}`, images: g.passcodeHash ? [] : image ? [image] : [] } }
}

function Centered({ theme, children }: { theme: string; children: React.ReactNode }) {
  return (
    <div className="g-root" style={themeVars(theme)}>
      <style dangerouslySetInnerHTML={{ __html: GALLERY_CSS }} />
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>{children}</main>
    </div>
  )
}

export default async function PublicGalleryPage({ params }: { params: { token: string } }) {
  const g = await lookup(params.token)
  if (!g || !g.published) notFound()

  if (g.expiresAt && Date.now() > g.expiresAt.getTime() + 12 * 3600 * 1000) {
    return (
      <Centered theme={g.theme}>
        <h1 className="g-serif" style={{ fontSize: 40, fontWeight: 500, margin: 0 }}>{g.title}</h1>
        <div style={{ color: 'var(--g-muted)', fontSize: 14 }}>This gallery link has expired. Please ask {g.brandSpace.name} to send you a new one.</div>
      </Centered>
    )
  }

  if (g.passcodeHash && cookies().get(unlockCookieName(g.shareToken))?.value !== unlockCookieValue(g.shareToken, g.passcodeHash)) {
    return (
      <Centered theme={g.theme}>
        <div className="g-eyebrow" style={{ color: 'var(--g-muted)' }}>{g.brandSpace.name}</div>
        <h1 className="g-serif" style={{ fontSize: 'clamp(36px, 7vw, 56px)', fontWeight: 500, margin: 0, lineHeight: 1.05 }}>{g.title}</h1>
        <div style={{ color: 'var(--g-muted)', fontSize: 14, marginBottom: 10 }}>This gallery is private. Enter the passcode you were given.</div>
        <PasscodeForm token={g.shareToken} />
      </Centered>
    )
  }

  const items: ViewItem[] = naturalSort(g.items).map((i) => {
    const display = i.webUrl || (i.kind === 'image' ? i.url : null)
    // When downloads are off we do not hand out the original of a picture that has a smaller copy to look at.
    const hideOriginal = !g.allowDownload && i.kind === 'image' && !!i.webUrl
    return { id: i.id, name: i.name, kind: i.kind as ViewItem['kind'], size: i.size, w: i.width, h: i.height, thumb: i.thumbUrl, display, full: hideOriginal ? null : i.url }
  })
  const coverItem = g.items.find((i) => i.id === g.coverItemId) ?? g.items.find((i) => i.kind === 'image')
  // Sharpest copy that is still light: the 2400px copy, else a small original, else the preview.
  const cover = coverItem ? coverItem.webUrl || (coverItem.kind === 'image' && coverItem.size <= 8 * 1024 * 1024 ? coverItem.url : null) || coverItem.thumbUrl : null

  return (
    <GalleryView
      title={g.title}
      brand={g.brandSpace.name}
      description={g.description}
      dateLabel={g.eventDate ? g.eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''}
      cover={cover}
      allowDownload={g.allowDownload}
      theme={g.theme}
      coverStyle={g.coverStyle}
      items={items}
    />
  )
}
