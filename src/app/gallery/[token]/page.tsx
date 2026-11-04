import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { unlockCookieName, unlockCookieValue } from '@/lib/gallery'
import { GALLERY_CSS, themeVars } from '@/lib/galleryTheme'
import PasscodeForm from './PasscodeForm'
import GalleryView, { type ViewItem } from './GalleryView'
import VideoDelivery from './VideoDelivery'
import { directUrl } from '@/lib/googleDrive'

export const dynamic = 'force-dynamic'

// The address can be the private code or the readable link the photographer chose.
const lookup = async (key: string) => {
  const include = { items: true, sets: { orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }] }, brandSpace: { select: { name: true } } }
  const byCode = await db.gallery.findUnique({ where: { shareToken: key }, include }).catch(() => null)
  return byCode ?? (await db.gallery.findUnique({ where: { slug: key }, include }).catch(() => null))
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const g = await lookup(params.token)
  if (!g || !g.published) return { title: 'Gallery' }
  const isVideo = g.layout === 'video'
  // For a video delivery the picture is the film's own frame; for a gallery it is the cover photo.
  const cover = (isVideo ? g.items.find((i) => i.id === g.coverItemId && i.kind === 'video' && (i.thumbUrl || i.driveThumbId)) ?? g.items.find((i) => i.kind === 'video' && (i.thumbUrl || i.driveThumbId)) : null) ?? g.items.find((i) => i.id === g.coverItemId) ?? g.items.find((i) => i.thumbUrl || i.driveThumbId)
  const site = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  const image = cover?.driveThumbId ? (site ? `${site}/api/gallery/${g.shareToken}/file/${cover.id}?v=t` : undefined) : cover?.thumbUrl || undefined
  // The preview picture is the small 720px copy made at upload; telling apps its real size helps WhatsApp and others show it as a big card.
  const k = cover?.width && cover?.height ? Math.min(1, 720 / Math.max(cover.width, cover.height)) : 0
  const size = k && cover?.width && cover?.height ? { width: Math.round(cover.width * k), height: Math.round(cover.height * k) } : {}
  const name = g.coverTitle || g.title
  // The title is shown when the link is shared; the picture stays hidden if there is a passcode.
  const title = isVideo ? `▶ ${name}` : name
  const description = g.passcodeHash
    ? 'This delivery is private. Open the link and enter the passcode you were given.'
    : isVideo
      ? `Watch${g.allowDownload ? ' and download' : ''} your video from ${g.brandSpace.name}${g.preparedFor ? ` · Prepared for ${g.preparedFor}` : ''}`
      : `A gallery from ${g.brandSpace.name}`
  const images = g.passcodeHash || !image ? [] : [{ url: image, ...size }]
  return {
    title: `${name} · ${g.brandSpace.name}`,
    robots: { index: false, follow: false },
    openGraph: { type: isVideo ? 'video.other' : 'website', siteName: g.brandSpace.name, title, description, images },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title, description, images: images.map((i) => i.url) },
  }
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
        <h1 className="g-serif" style={{ fontSize: 40, fontWeight: 500, margin: 0 }}>{g.coverTitle || g.title}</h1>
        <div style={{ color: 'var(--g-muted)', fontSize: 14 }}>This gallery link has expired. Please ask {g.brandSpace.name} to send you a new one.</div>
      </Centered>
    )
  }

  if (g.passcodeHash && cookies().get(unlockCookieName(g.shareToken))?.value !== unlockCookieValue(g.shareToken, g.passcodeHash)) {
    return (
      <Centered theme={g.theme}>
        <div className="g-eyebrow" style={{ color: 'var(--g-muted)' }}>{g.brandSpace.name}</div>
        <h1 className="g-serif" style={{ fontSize: 'clamp(36px, 7vw, 56px)', fontWeight: 500, margin: 0, lineHeight: 1.05 }}>{g.coverTitle || g.title}</h1>
        <div style={{ color: 'var(--g-muted)', fontSize: 14, marginBottom: 10 }}>This gallery is private. Enter the passcode you were given.</div>
        <PasscodeForm token={g.shareToken} />
      </Centered>
    )
  }

  // Files in Google Drive are served through Brand Console (so the gallery's passcode, expiry and download rules apply);
  // files in Brand Console storage are linked directly.
  const SMALL = 8 * 1024 * 1024
  const urls = (i: (typeof g.items)[number]) => {
    if (i.driveFileId) {
      const base = `/api/gallery/${g.shareToken}/file/${i.id}`
      const original = `${base}?v=o`
      return {
        thumb: i.driveThumbId ? `${base}?v=t` : null,
        web: i.driveWebId ? `${base}?v=w` : null,
        // a small original can be shown as is, but only when downloads are allowed (the server enforces this too)
        small: g.allowDownload && i.kind === 'image' && i.size <= SMALL ? original : null,
        original,
        hasWeb: !!i.driveWebId,
      }
    }
    return { thumb: i.thumbUrl, web: i.webUrl, small: i.kind === 'image' ? i.url : null, original: i.url, hasWeb: !!i.webUrl }
  }

  const items: ViewItem[] = g.items.map((i) => {
    const u = urls(i)
    // For a video the viewing copy is its lighter "watch version": the video page streams it, the original stays the download.
    const display = i.kind === 'video' ? (g.layout === 'video' ? u.web : null) : u.web || u.small
    // When downloads are off we do not hand out the original of a picture that has a smaller copy to look at.
    const hideOriginal = !g.allowDownload && i.kind === 'image' && u.hasWeb
    const view: ViewItem = { id: i.id, name: i.name, kind: i.kind as ViewItem['kind'], size: i.size, w: i.width, h: i.height, thumb: u.thumb, display, full: hideOriginal ? null : u.original, setId: i.setId, capturedAt: i.capturedAt ? i.capturedAt.toISOString() : null }
    // A video kept in Google Drive and shared by link is streamed by the viewer's browser straight from Google (faster, and it does not
    // depend on Brand Console's own Google login). The route through Brand Console stays as the fallback. Not used with a passcode or expiry.
    if (g.layout === 'video' && i.kind === 'video' && i.driveFileId && i.drivePublic && !g.passcodeHash && !g.expiresAt) {
      return { ...view, thumb: i.driveThumbId ? directUrl(i.driveThumbId) : view.thumb, display: i.driveWebId ? directUrl(i.driveWebId) : null, full: directUrl(i.driveFileId), embed: `https://drive.google.com/file/d/${encodeURIComponent(i.driveFileId)}/preview`, fallback: { thumb: view.thumb, display: view.display, full: view.full } }
    }
    return view
  })
  const dateLabel = g.eventDate ? g.eventDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''

  // A single-video delivery gets its own page: the film, a download button, and the thank-you message.
  if (g.layout === 'video') {
    return (
      <VideoDelivery
        title={g.coverTitle || g.title}
        brand={g.brandSpace.name}
        subtitle={g.coverSubtitle}
        preparedFor={g.preparedFor}
        description={g.description}
        dateLabel={dateLabel}
        allowDownload={g.allowDownload}
        theme={g.theme}
        featuredId={g.coverItemId}
        introKey={g.shareToken}
        items={items}
      />
    )
  }

  const coverItem = g.items.find((i) => i.id === g.coverItemId) ?? g.items.find((i) => i.kind === 'image')
  // Sharpest copy that is still light: the 2400px copy, else a small original, else the preview.
  const cu = coverItem ? urls(coverItem) : null
  const cover = cu ? cu.web || cu.small || cu.thumb : null

  return (
    <GalleryView
      title={g.coverTitle || g.title}
      brand={g.brandSpace.name}
      subtitle={g.coverSubtitle}
      preparedFor={g.preparedFor}
      description={g.description}
      dateLabel={dateLabel}
      cover={cover}
      allowDownload={g.allowDownload}
      theme={g.theme}
      coverStyle={g.coverStyle}
      sets={g.sets.map((x) => ({ id: x.id, name: x.name }))}
      mainSetName={g.mainSetName}
      sortMode={g.sortMode}
      favKey={g.shareToken}
      items={items}
    />
  )
}
