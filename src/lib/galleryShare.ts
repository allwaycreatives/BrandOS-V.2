import { db } from '@/lib/db'
import { makeFilesPublic } from '@/lib/googleDrive'

export type ShareResult = { state: 'on' | 'off' | 'skipped'; detail: string }

// A published video delivery kept in Google Drive is streamed to the viewer straight from Google (or, if that fails, shown in
// Google's own player). For that, its Drive files are shared "anyone with the link" (the link is long and unguessable, and only
// appears on the delivery page). Not done when the delivery has a passcode or an expiry date: those need Brand Console in the middle.
// Safe to call again and again: it only touches files that are not shared yet, and it never throws.
export async function ensureDirectViewing(galleryId: string): Promise<ShareResult> {
  try {
    const g = await db.gallery.findUnique({ where: { id: galleryId }, include: { items: true, driveConnection: true } })
    if (!g || g.layout !== 'video' || g.storage !== 'drive' || !g.driveConnection) return { state: 'skipped', detail: 'Only video deliveries kept in Google Drive are shared this way.' }
    if (!g.published) return { state: 'skipped', detail: 'Publish the delivery first.' }
    if (g.passcodeHash || g.expiresAt) return { state: 'skipped', detail: 'Not used, because this delivery has a passcode or an expiry date. Those need Brand Console in the middle.' }
    const videos = g.items.filter((it) => it.kind === 'video' && it.driveFileId)
    if (videos.length === 0) return { state: 'skipped', detail: 'There is no video to share yet.' }
    const problems: string[] = []
    for (const it of videos) {
      if (it.drivePublic) continue
      const ids = [it.driveFileId, it.driveWebId, it.driveThumbId].filter((x): x is string => !!x)
      const r = await makeFilesPublic(g.driveConnection, ids)
      if (r.ok) await db.galleryItem.update({ where: { id: it.id }, data: { drivePublic: true } })
      else problems.push(...r.problems)
    }
    if (problems.length) return { state: 'off', detail: `Could not share the video files. ${problems[0]}.` }
    return { state: 'on', detail: 'The video is shared by link, so viewers watch it straight from Google.' }
  } catch (e) {
    console.warn('[drive-share]', (e as Error).message)
    return { state: 'off', detail: 'Could not share the video files just now.' }
  }
}
