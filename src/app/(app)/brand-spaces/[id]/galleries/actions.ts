'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { del } from '@vercel/blob'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'
import { accessTokenFor, deleteDriveFiles, driveConfigured, fileInfo, revokeToken, decrypt } from '@/lib/googleDrive'
import { newGalleryToken, hashPasscode, isGalleryBlobUrl } from '@/lib/gallery'
import { kindOf, checkSlug } from '@/lib/galleryFormat'

async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to manage galleries here.')
}

async function galleryForEdit(galleryId: string) {
  const g = await db.gallery.findUnique({ where: { id: galleryId } })
  if (!g) throw new Error('Gallery not found.')
  await requireEdit(g.brandSpaceId)
  return g
}

function refresh(brandSpaceId: string, galleryId?: string) {
  revalidatePath(`/brand-spaces/${brandSpaceId}/galleries`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/projects`, 'layout')
  if (galleryId) revalidatePath(`/brand-spaces/${brandSpaceId}/galleries/${galleryId}`)
}

const parseDate = (v: FormDataEntryValue | null) => {
  const s = String(v || '').trim()
  if (!s) return null
  const d = new Date(s + 'T12:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

async function deleteBlobs(urls: (string | null | undefined)[]) {
  const list = urls.filter((u): u is string => !!u)
  for (let i = 0; i < list.length; i += 100) {
    try {
      await del(list.slice(i, i + 100))
    } catch (e) {
      console.warn('[gallery] could not delete some files from storage', e)
    }
  }
}

const COVER_STYLES = ['full', 'split', 'classic']
const THEMES = ['light', 'dark']

// Only projects of the same brand can be linked.
async function projectIdFor(brandSpaceId: string, raw: FormDataEntryValue | null): Promise<string | null> {
  const id = String(raw || '')
  if (!id) return null
  const p = await db.project.findUnique({ where: { id } }).catch(() => null)
  return p && p.brandSpaceId === brandSpaceId ? p.id : null
}

export async function createGallery(formData: FormData) {
  const brandSpaceId = String(formData.get('brandSpaceId') || '')
  const title = String(formData.get('title') || '').trim().slice(0, 200)
  if (!brandSpaceId || !title) return
  await requireEdit(brandSpaceId)
  const projectId = await projectIdFor(brandSpaceId, formData.get('projectId'))
  // If this person connected Google Drive, the files live in their Drive (their space, their quota).
  const { user } = await getOrCreateCurrentUser()
  const conn = driveConfigured() ? await db.googleConnection.findUnique({ where: { userId: user.id } }).catch(() => null) : null
  const g = await db.gallery.create({
    data: { brandSpaceId, projectId, title, eventDate: parseDate(formData.get('eventDate')), shareToken: newGalleryToken(), storage: conn ? 'drive' : 'blob', driveConnectionId: conn?.id ?? null },
  })
  refresh(brandSpaceId)
  if (projectId) revalidatePath(`/brand-spaces/${brandSpaceId}/projects/${projectId}`)
  redirect(`/brand-spaces/${brandSpaceId}/galleries/${g.id}`)
}

export async function updateGallery(galleryId: string, formData: FormData) {
  const g = await galleryForEdit(galleryId)
  const title = String(formData.get('title') || '').trim().slice(0, 200)
  if (!title) return
  await db.gallery.update({
    where: { id: galleryId },
    data: {
      title,
      coverTitle: String(formData.get('coverTitle') || '').trim().slice(0, 200) || null,
      coverSubtitle: String(formData.get('coverSubtitle') || '').trim().slice(0, 200) || null,
      preparedFor: String(formData.get('preparedFor') || '').trim().slice(0, 200) || null,
      description: String(formData.get('description') || '').trim().slice(0, 2000) || null,
      eventDate: parseDate(formData.get('eventDate')),
      expiresAt: parseDate(formData.get('expiresAt')),
      allowDownload: formData.get('allowDownload') === 'on',
      projectId: await projectIdFor(g.brandSpaceId, formData.get('projectId')),
      coverStyle: COVER_STYLES.includes(String(formData.get('coverStyle'))) ? String(formData.get('coverStyle')) : g.coverStyle,
      theme: THEMES.includes(String(formData.get('theme'))) ? String(formData.get('theme')) : g.theme,
    },
  })
  refresh(g.brandSpaceId, galleryId)
  if (g.projectId) revalidatePath(`/brand-spaces/${g.brandSpaceId}/projects/${g.projectId}`)
}

export async function setGalleryPublished(galleryId: string, published: boolean) {
  const g = await galleryForEdit(galleryId)
  await db.gallery.update({ where: { id: galleryId }, data: { published } })
  refresh(g.brandSpaceId, galleryId)
}

export async function setGalleryPasscode(galleryId: string, formData: FormData) {
  const g = await galleryForEdit(galleryId)
  const passcode = String(formData.get('passcode') || '').trim().slice(0, 100)
  await db.gallery.update({ where: { id: galleryId }, data: { passcodeHash: passcode ? hashPasscode(g.shareToken, passcode) : null } })
  refresh(g.brandSpaceId, galleryId)
}

export type NewGalleryItem = {
  name: string
  url?: string
  thumbUrl?: string | null
  webUrl?: string | null
  drive?: { fileId: string; thumbId?: string | null; webId?: string | null }
  contentType: string
  size: number
  width?: number | null
  height?: number | null
}

// Called by the browser after a file has finished uploading.
export async function addGalleryItem(galleryId: string, input: NewGalleryItem): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    const g = await db.gallery.findUnique({ where: { id: galleryId }, include: { driveConnection: true } })
    if (!g) return { error: 'Gallery not found.' }
    await requireEdit(g.brandSpaceId)
    const name = String(input.name || 'file').slice(0, 255)
    const contentType = String(input.contentType || 'application/octet-stream').slice(0, 120)
    const kind = kindOf(contentType, name)
    const int = (n: unknown) => (typeof n === 'number' && isFinite(n) && n > 0 && n < 100000 ? Math.round(n) : null)
    let size = Math.max(0, Number(input.size) || 0)

    let files: { url: string; thumbUrl: string | null; webUrl: string | null; driveFileId: string | null; driveThumbId: string | null; driveWebId: string | null }
    if (g.storage === 'drive') {
      const d = input.drive
      if (!d?.fileId || !g.driveConnection || !g.driveFolderId || !g.drivePreviewsId) return { error: 'This gallery is stored in Google Drive.' }
      // Make sure these files really sit in this gallery's folder in the owner's Drive.
      const token = await accessTokenFor(g.driveConnection)
      const orig = await fileInfo(token, d.fileId)
      if (!orig?.parents?.includes(g.driveFolderId)) return { error: 'That file is not in this gallery.' }
      if (orig.size) size = Number(orig.size) || size
      const okPreview = async (id?: string | null) => (id && (await fileInfo(token, id))?.parents?.includes(g.drivePreviewsId!) ? id : null)
      files = { url: `drive:${d.fileId}`, thumbUrl: null, webUrl: null, driveFileId: d.fileId, driveThumbId: await okPreview(d.thumbId), driveWebId: await okPreview(d.webId) }
    } else {
      if (!isGalleryBlobUrl(input.url, galleryId)) return { error: 'That file is not in this gallery.' }
      files = {
        url: input.url!,
        thumbUrl: isGalleryBlobUrl(input.thumbUrl, galleryId) ? input.thumbUrl! : null,
        webUrl: isGalleryBlobUrl(input.webUrl, galleryId) ? input.webUrl! : null,
        driveFileId: null,
        driveThumbId: null,
        driveWebId: null,
      }
    }

    const item = await db.galleryItem.create({ data: { galleryId, name, contentType, kind, size, width: int(input.width), height: int(input.height), ...files } })
    if (!g.coverItemId && kind === 'image') await db.gallery.update({ where: { id: galleryId }, data: { coverItemId: item.id } })
    return { ok: true, id: item.id }
  } catch (e) {
    return { error: (e as Error).message || 'Could not save that file.' }
  }
}

export async function deleteGalleryItem(itemId: string) {
  const item = await db.galleryItem.findUnique({ where: { id: itemId }, include: { gallery: { include: { driveConnection: true } } } })
  if (!item) return
  await requireEdit(item.gallery.brandSpaceId)
  await db.galleryItem.delete({ where: { id: itemId } })
  if (item.gallery.coverItemId === itemId) {
    const next = await db.galleryItem.findFirst({ where: { galleryId: item.galleryId, kind: 'image' }, orderBy: { createdAt: 'asc' } })
    await db.gallery.update({ where: { id: item.galleryId }, data: { coverItemId: next?.id ?? null } })
  }
  if (item.gallery.driveConnection) await deleteDriveFiles(item.gallery.driveConnection, [item.driveFileId, item.driveThumbId, item.driveWebId])
  await deleteBlobs([item.driveFileId ? null : item.url, item.thumbUrl, item.webUrl])
  refresh(item.gallery.brandSpaceId, item.galleryId)
}

export async function setGalleryCover(galleryId: string, itemId: string) {
  const g = await galleryForEdit(galleryId)
  const item = await db.galleryItem.findUnique({ where: { id: itemId } })
  if (!item || item.galleryId !== galleryId || item.kind === 'file') return
  await db.gallery.update({ where: { id: galleryId }, data: { coverItemId: itemId } })
  refresh(g.brandSpaceId, galleryId)
}

export async function deleteGallery(galleryId: string) {
  const g = await galleryForEdit(galleryId)
  const items = await db.galleryItem.findMany({ where: { galleryId } })
  const conn = g.driveConnectionId ? await db.googleConnection.findUnique({ where: { id: g.driveConnectionId } }) : null
  await db.gallery.delete({ where: { id: galleryId } })
  if (conn && g.driveFolderId) await deleteDriveFiles(conn, [g.driveFolderId]) // removes the folder and everything in it
  await deleteBlobs(items.flatMap((i) => [i.driveFileId ? null : i.url, i.thumbUrl, i.webUrl]))
  refresh(g.brandSpaceId)
  redirect(`/brand-spaces/${g.brandSpaceId}/galleries`)
}

// Stop using Google Drive: the key is revoked and forgotten. Files already in Drive stay there, but
// galleries kept in that Drive stop being served until it is connected again.
export async function disconnectGoogleDrive() {
  const { user } = await getOrCreateCurrentUser()
  const conn = await db.googleConnection.findUnique({ where: { userId: user.id } })
  if (!conn) return
  try {
    await revokeToken(decrypt(conn.refreshToken))
  } catch {}
  await db.googleConnection.delete({ where: { id: conn.id } })
  revalidatePath('/brand-spaces', 'layout')
}

// Gives the gallery an easy-to-read link. The original private link keeps working too.
export async function setGallerySlug(galleryId: string, raw: string): Promise<{ ok: true; slug: string | null } | { error: string }> {
  try {
    const g = await galleryForEdit(galleryId)
    const text = (raw || '').trim()
    if (!text) {
      await db.gallery.update({ where: { id: galleryId }, data: { slug: null } })
      refresh(g.brandSpaceId, galleryId)
      return { ok: true, slug: null }
    }
    const c = checkSlug(text)
    if (!c.ok) return { error: c.error }
    const [bySlug, byToken] = await Promise.all([db.gallery.findUnique({ where: { slug: c.slug } }), db.gallery.findUnique({ where: { shareToken: c.slug } })])
    if ((bySlug && bySlug.id !== galleryId) || (byToken && byToken.id !== galleryId)) return { error: 'That link is already used by another gallery. Try adding a word or a number.' }
    await db.gallery.update({ where: { id: galleryId }, data: { slug: c.slug } })
    refresh(g.brandSpaceId, galleryId)
    return { ok: true, slug: c.slug }
  } catch (e) {
    return { error: (e as Error).message || 'Could not save the link.' }
  }
}
