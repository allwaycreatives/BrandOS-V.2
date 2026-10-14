import { upload } from '@vercel/blob/client'

// One place for every browser -> Vercel Blob upload in the app.
//  - Big photos are shrunk in the browser first (a 15 MB phone photo becomes ~1 MB),
//    which is the single biggest speed-up.
//  - Real progress is reported so the UI can show a bar.
//  - A stalled connection is detected and retried instead of hanging forever.
//  - Callers get a plain-English error message they can show directly.

export type UploadPhase = 'preparing' | 'uploading' | 'retrying'

export type UploadResult = { url: string; name: string }

export type UploadOptions = {
  onProgress?: (percent: number, phase: UploadPhase) => void
  signal?: AbortSignal
  /** Shrink large JPEG/PNG/WebP images before uploading. Default true. */
  compress?: boolean
}

const MAX_EDGE = 2400 // longest side, in pixels, after shrinking
const COMPRESS_ABOVE = 1.5 * 1024 * 1024 // images smaller than this are left alone
const MULTIPART_ABOVE = 8 * 1024 * 1024 // big files are split into parallel, individually-retried parts
const STALL_MS = 45_000 // no progress for this long = connection is stuck
const MAX_ATTEMPTS = 3

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }

export class UploadError extends Error {
  retryable: boolean
  constructor(message: string, retryable = true) {
    super(message)
    this.name = 'UploadError'
    this.retryable = retryable
  }
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

/** Shrinks big images in the browser. Returns the original file if anything goes wrong or it would not help. */
export async function prepareImage(file: File): Promise<File> {
  if (!(file.type in EXT)) return file // GIF, SVG, HEIC and friends are uploaded untouched
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= COMPRESS_ABOVE) return file

    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)

    // JPEG stays JPEG. PNG/WebP become WebP, which keeps transparency (Safari quietly falls back to PNG).
    const wanted = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, wanted, 0.86))
    if (!blob || blob.size >= file.size) return file

    const base = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], base + (EXT[blob.type] ?? EXT[file.type]), { type: blob.type, lastModified: Date.now() })
  } catch {
    return file
  } finally {
    bitmap.close()
  }
}

export function friendlyUploadError(err: unknown): UploadError {
  if (err instanceof UploadError) return err
  const msg = err instanceof Error ? err.message : ''
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new UploadError('You appear to be offline. Reconnect and try again.')
  }
  if (/sign in|unauth|401|403/i.test(msg)) {
    return new UploadError('Your session has expired. Refresh the page and sign in again.', false)
  }
  if (/content.?type|not allowed|unsupported/i.test(msg)) {
    return new UploadError('That file type is not supported.', false)
  }
  if (/exceed|too large|maximum|size/i.test(msg)) {
    return new UploadError('That file is too large.', false)
  }
  return new UploadError('Upload failed. Check your connection and try again.')
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const { onProgress, signal, compress = true } = opts
  const cancelled = () => new UploadError('Upload cancelled.', false)
  if (signal?.aborted) throw cancelled()

  let body = file
  if (compress && isImageFile(file)) {
    onProgress?.(0, 'preparing')
    body = await prepareImage(file)
    if (signal?.aborted) throw cancelled()
  }

  let lastError: UploadError | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    let stalled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        stalled = true
        controller.abort()
      }, STALL_MS)
    }
    const onUserAbort = () => controller.abort()
    signal?.addEventListener('abort', onUserAbort)

    try {
      onProgress?.(0, attempt === 1 ? 'uploading' : 'retrying')
      arm()
      const blob = await upload(body.name, body, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        multipart: body.size > MULTIPART_ABOVE,
        abortSignal: controller.signal,
        onUploadProgress: (e) => {
          arm()
          onProgress?.(Math.min(100, Math.round(e.percentage)), 'uploading')
        },
      })
      onProgress?.(100, 'uploading')
      return { url: blob.url, name: body.name }
    } catch (err) {
      if (signal?.aborted) throw cancelled()
      lastError = stalled
        ? new UploadError('The upload stalled. Check your connection and try again.')
        : friendlyUploadError(err)
      if (!lastError.retryable) throw lastError
      if (attempt < MAX_ATTEMPTS) {
        onProgress?.(0, 'retrying')
        await sleep(800 * attempt * attempt)
        if (signal?.aborted) throw cancelled()
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onUserAbort)
    }
  }
  throw lastError ?? new UploadError('Upload failed. Please try again.')
}
