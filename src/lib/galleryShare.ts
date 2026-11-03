import { db } from '@/lib/db'
import { makeFilesPublic } from '@/lib/googleDrive'

// A published video delivery kept in Google Drive is streamed to the viewer straight from Google. For that, its Drive files
// are shared "anyone with the link" (the link is long and unguessable, and only appears on the delivery page).
// Not done when the delivery has a passcode or an expiry date: those need Brand Console to stay in the middle.
// Safe to call again and again: it only touches files that are not shared yet. Any failure is ignored, because the page
// then simply keeps using the route through Brand Console.
export async function ensureDirectViewing(galleryId: string): Promise<void> {
  try {
    const g = await db.gallery.findUnique({ where: { id: galleryId }, include: { items: true, driveConnection: true } })
    if (!g || g.layout !== 'video' || g.storage !== 'drive' || !g.driveConnection || !g.published || g.passcodeHash || g.expiresAt) return
    for (const it of g.items) {
      if (it.kind !== 'video' || !it.driveFileId || it.drivePublic) continue
      const ids = [it.driveFileId, it.driveWebId, it.driveThumbId].filter((x): x is string => !!x)
      if (await makeFilesPublic(g.driveConnection, ids)) await db.galleryItem.update({ where: { id: it.id }, data: { drivePublic: true } })
    }
  } catch (e) {
    console.warn('[drive-share]', (e as Error).message)
  }
}
