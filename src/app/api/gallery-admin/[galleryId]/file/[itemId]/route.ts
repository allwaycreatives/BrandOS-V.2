import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { streamDriveFile } from '@/lib/driveStream'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const text = (status: number, message: string) => new Response(message, { status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } })

// Lets the people who manage a brand see the gallery's files from Google Drive while they work on it,
// even before the gallery is published. Only for signed-in team members of this brand.
export async function GET(request: Request, { params }: { params: { galleryId: string; itemId: string } }) {
  const variant = new URL(request.url).searchParams.get('v') || 't' // t = small preview, w = viewing copy, o = original
  const gallery = await db.gallery.findUnique({ where: { id: params.galleryId }, include: { driveConnection: true } }).catch(() => null)
  if (!gallery || gallery.storage !== 'drive' || !gallery.driveConnection) return text(404, 'Not found')
  const access = await assertBrandSpaceAccess(gallery.brandSpaceId).catch(() => null)
  if (!access || access.role === 'client') return text(401, 'Please sign in')

  const item = await db.galleryItem.findUnique({ where: { id: params.itemId } }).catch(() => null)
  if (!item || item.galleryId !== gallery.id) return text(404, 'Not found')
  const fileId = variant === 'o' ? item.driveFileId : variant === 'w' ? item.driveWebId || item.driveFileId : item.driveThumbId
  if (!fileId) return text(404, 'Not found')

  return streamDriveFile(gallery.driveConnection, fileId, request, {
    contentType: variant === 'o' || (variant === 'w' && !item.driveWebId) ? item.contentType || 'application/octet-stream' : '',
    cacheControl: 'private, max-age=600',
  })
}
