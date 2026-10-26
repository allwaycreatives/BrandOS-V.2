import { db } from '@/lib/db'
import { unlockCookieName, unlockCookieValue } from '@/lib/gallery'
import { accessTokenFor, DRIVE_API } from '@/lib/googleDrive'

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

  const range = request.headers.get('range')
  const ask = async (force: boolean) =>
    fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { authorization: `Bearer ${await accessTokenFor(gallery.driveConnection!, force)}`, ...(range ? { range } : {}) } })
  let up: Response
  try {
    up = await ask(false)
    if (up.status === 401) up = await ask(true)
  } catch {
    return text(502, 'Google Drive is not reachable right now')
  }
  if (up.status === 404 || up.status === 403) return text(404, 'Not found')
  if (!up.ok && up.status !== 206) return text(502, 'Google Drive could not provide this file')

  const headers = new Headers()
  headers.set('content-type', variant === 'o' ? item.contentType || 'application/octet-stream' : up.headers.get('content-type') || 'image/jpeg')
  headers.set('accept-ranges', 'bytes')
  for (const h of ['content-length', 'content-range']) {
    const v = up.headers.get(h)
    if (v && !up.headers.get('content-encoding')) headers.set(h, v)
  }
  if (variant === 'o') {
    headers.set('cache-control', 'private, no-store')
    if (asDownload) {
      const ascii = item.name.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_')
      headers.set('content-disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(item.name)}`)
    }
  } else {
    // Previews are small and safe to cache; with a passcode they may only live in the visitor's own browser.
    headers.set('cache-control', gallery.passcodeHash ? 'private, max-age=3600' : 'public, max-age=3600, s-maxage=3600')
  }
  return new Response(up.body, { status: up.status === 206 ? 206 : 200, headers })
}
