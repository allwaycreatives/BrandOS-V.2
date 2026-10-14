import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { ALLOWED_UPLOAD_TYPES } from '@/lib/uploadTypes'

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024 // 500 MB

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Only signed-in users can upload. (Vercel's own "upload finished"
        // callback doesn't go through this check; it is verified by signature.)
        const { userId } = auth()
        if (!userId) throw new Error('UNAUTHENTICATED')

        return {
          allowedContentTypes: ALLOWED_UPLOAD_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        }
      },
      onUploadCompleted: async () => {
        // Nothing to do here — the task's fileUrl is saved once the
        // browser gets the finished blob URL back.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    const message = (error as Error).message
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Please sign in to upload files.' }, { status: 401 })
    }
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
