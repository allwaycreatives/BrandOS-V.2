import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { accessTokenFor, createFolder, DriveAuthError, folderExists } from '@/lib/googleDrive'

export const dynamic = 'force-dynamic'

// Gives the photographer's browser a one-hour key so it can send files straight into the gallery's Drive folder.
// (Files go from the browser to Google; they never pass through BrandOS.)
export async function POST(request: Request) {
  try {
    const { galleryId } = (await request.json()) as { galleryId?: string }
    const gallery = galleryId ? await db.gallery.findUnique({ where: { id: galleryId }, include: { driveConnection: true, brandSpace: { select: { name: true } } } }) : null
    if (!gallery) return NextResponse.json({ error: 'Gallery not found.' }, { status: 404 })
    const access = await assertBrandSpaceAccess(gallery.brandSpaceId).catch(() => null)
    if (!access || access.role === 'client') return NextResponse.json({ error: 'Please sign in to upload files.' }, { status: 401 })
    const conn = gallery.driveConnection
    if (gallery.storage !== 'drive' || !conn) return NextResponse.json({ error: 'This gallery is not set up for Google Drive.' }, { status: 400 })

    const token = await accessTokenFor(conn)

    // Folders: "BrandOS Galleries" > "<brand> · <gallery>" > "_previews"
    let rootId = conn.rootFolderId
    if (!rootId || !(await folderExists(token, rootId))) {
      rootId = await createFolder(token, 'BrandOS Galleries')
      await db.googleConnection.update({ where: { id: conn.id }, data: { rootFolderId: rootId } })
    }
    let folderId = gallery.driveFolderId
    let previewsId = gallery.drivePreviewsId
    if (!folderId || !previewsId || !(await folderExists(token, folderId))) {
      folderId = await createFolder(token, `${gallery.brandSpace.name} · ${gallery.title}`, rootId)
      previewsId = await createFolder(token, '_previews', folderId)
      await db.gallery.update({ where: { id: gallery.id }, data: { driveFolderId: folderId, drivePreviewsId: previewsId } })
    }
    return NextResponse.json({ accessToken: token, expiresIn: 3000, folderId, previewsId }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    if (e instanceof DriveAuthError) return NextResponse.json({ error: e.message, reconnect: true }, { status: 409 })
    return NextResponse.json({ error: (e as Error).message || 'Could not reach Google Drive.' }, { status: 500 })
  }
}
