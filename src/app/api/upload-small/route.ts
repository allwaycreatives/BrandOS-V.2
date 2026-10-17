import { put } from '@vercel/blob'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAllowedUploadType } from '@/lib/uploadTypes'

// Small files (photos after the browser has shrunk them) go through here: the browser sends the file to
// our own server, and the server saves it to Blob. Same-site, so no CORS, and real upload progress.
// Vercel limits request bodies to about 4.5 MB, so anything bigger is uploaded straight to Blob instead.
export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BYTES = 4.4 * 1024 * 1024

export async function POST(request: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Please sign in to upload files.' }, { status: 401 })

  const url = new URL(request.url)
  const name = (url.searchParams.get('name') ?? 'upload').replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'upload'
  const type = (request.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim()

  if (!isAllowedUploadType(type)) {
    return NextResponse.json({ error: `That file type (${type}) is not supported.` }, { status: 415 })
  }
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BYTES) return NextResponse.json({ error: 'File too large for this route.' }, { status: 413 })

  try {
    const data = Buffer.from(await request.arrayBuffer())
    if (data.length === 0) return NextResponse.json({ error: 'The file was empty.' }, { status: 400 })
    if (data.length > MAX_BYTES) return NextResponse.json({ error: 'File too large for this route.' }, { status: 413 })
    const blob = await put(name, data, { access: 'public', addRandomSuffix: true, contentType: type })
    return NextResponse.json({ url: blob.url, pathname: blob.pathname })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[upload-small] Blob put failed:', message)
    return NextResponse.json({ error: `Storage rejected the upload: ${message}` }, { status: 502 })
  }
}
