import { db } from '@/lib/db'
import { unlockCookieName, unlockCookieValue } from '@/lib/gallery'
import { streamDriveFile } from '@/lib/driveStream'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // the longest a free Vercel plan allows; big files are fetched in pieces by the page

const text = (status: number, message: string) => new Response(message, { status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } })

// Serves a gallery file from the owner's Google Drive, but only under the gallery's own rules:
// published, not expired, passcode entered, downloads allowed. The Drive files themselves stay private.
export async function GET(request: Request, { params }: { params: { token: string; itemId: string } }) {
  const url = new URL(request.url)
  const variant = url.searchParams.get('v') || 'o' // o = original, w = viewing copy, t = small preview
  const asDownload = url.searchParams.get('dl') === '1'

  const gallery = await db.gallery.findUnique({ where: { shareToken: params.token }, include: { driveConnection: true } }).catch(() => null)
  if (!gallery || !gallery.published || gallery.storage !== 'drive' || !gallery.driveConnection) return text(404, 'Not found')
  if (gallery.expiresAt && Date.now() > gallery.expiresAt.getTime() + 12 * 3600 * 1000) return text(410, 'This gallery has expired')
  if (gallery.passcodeHash) {
    const cookie = request.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(unlockCookieName(gallery.shareToken) + '='))?.split('=')[1]
    if (cookie !== unlockCookieValue(gallery.shareToken, gallery.passcodeHash)) return text(403, 'Passcode needed')
  }

  const item = await db.galleryItem.findUnique({ where: { id: params.itemId } }).catch(() => null)
  if (!item || item.galleryId !== gallery.id) return text(404, 'Not found')

  const fileId = variant === 't' ? item.driveThumbId : variant === 'w' ? item.driveWebId : item.driveFileId
  if (!fileId) return text(404, 'Not found')
  if (variant === 'o' && !gallery.allowDownload && (asDownload || item.kind !== 'video')) return text(403, 'Downloads are turned off for this gallery')

  const cacheControl = variant === 'o' ? 'private, no-store' : gallery.passcodeHash ? 'private, max-age=3600' : 'public, max-age=3600, s-maxage=3600'
  return streamDriveFile(gallery.driveConnection, fileId, request, {
    // previews keep Drive's own type (jpeg/webp); originals use the type we recorded when they were uploaded
    contentType: variant === 'o' ? item.contentType || 'application/octet-stream' : '',
    cacheControl,
    downloadName: variant === 'o' && asDownload ? item.name : undefined,
  })
}
