import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

const MAX_FILE_BYTES = 50 * 1024 * 1024 * 1024 // 50 GB per file (storage itself allows far more)

// Hands the browser a one-time permission to upload straight into one gallery's folder.
// The files never pass through our server, which is what makes gigabyte uploads possible.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let galleryId = ''
        try {
          galleryId = String(JSON.parse(clientPayload || '{}').galleryId || '')
        } catch {}
        const gallery = galleryId ? await db.gallery.findUnique({ where: { id: galleryId } }) : null
        if (!gallery) throw new Error('GALLERY_NOT_FOUND')

        // Only people who can manage this brand may add files, and only into this gallery's folder.
        const access = await assertBrandSpaceAccess(gallery.brandSpaceId).catch(() => null)
        if (!access || access.role === 'client') throw new Error('UNAUTHENTICATED')
        if (!pathname.startsWith(`galleries/${gallery.id}/`) || pathname.includes('..')) throw new Error('BAD_PATH')

        return {
          allowedContentTypes: ['image/*', 'video/*', 'audio/*', 'application/zip', 'application/x-zip-compressed', 'application/pdf', 'application/octet-stream'],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false, // keep the original file name so downloads have the right name
          allowOverwrite: false,
        }
      },
      onUploadCompleted: async () => {
        // The gallery item is saved by the browser once the file is in.
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    const message = (error as Error).message
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Please sign in to upload files.' }, { status: 401 })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
