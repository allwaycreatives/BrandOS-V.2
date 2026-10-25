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
  /** Skip our server relay and send straight to storage (needed for gallery originals). */
  direct?: boolean
  /** Which route hands out the upload permission. Default /api/upload. */
  handleUploadUrl?: string
  /** Extra info passed to that route (it checks who may upload where). */
  clientPayload?: string
  /** Where the file is stored. Default: the file name. */
  pathname?: string
  /** How long with no movement before an upload counts as stuck. Default 15 s; big files use more. */
  stallMs?: number
}

const MAX_EDGE = 2400 // longest side, in pixels, after shrinking
const COMPRESS_ABOVE = 1.5 * 1024 * 1024 // images smaller than this are left alone
const MULTIPART_ABOVE = 8 * 1024 * 1024 // big files are split into parallel, individually-retried parts
const STALL_MS = 15_000 // with progress events: no movement for this long = stuck
const plainTimeoutMs = (bytes: number) => Math.max(60_000, (bytes / (40 * 1024)) * 1000) // without progress events: assume at least ~40 KB/s
const MAX_ATTEMPTS = 3
const RELAY_MAX_BYTES = 4 * 1024 * 1024 // up to this size, files go via our own server (Vercel caps request bodies at ~4.5 MB)

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

// The SDK reports progress through a streaming fetch in Chrome. On some networks (VPNs, proxies, antivirus)
// that path hangs while a plain upload works fine. If it stalls, we fall back to the plain upload, and
// remember that for the rest of the session so later uploads skip the 15 second wait.
let streamingProgressBroken = false

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class RelayError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// One try at sending the file to our own server (/api/upload-small), which saves it to Blob.
// XHR gives real upload progress, and there is no cross-site request, so no CORS to go wrong.
function relayOnce(body: File, signal: AbortSignal, onProgress: (percent: number) => void, onActivity: (sent: boolean) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/upload-small?name=${encodeURIComponent(body.name)}`)
    xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream')
    xhr.upload.onprogress = (e) => {
      onActivity(false)
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.upload.onload = () => onActivity(true) // all bytes sent; now the server is saving it
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.url) return resolve({ url: data.url, name: body.name })
      reject(new RelayError(data.error || `Server answered ${xhr.status}`, xhr.status))
    }
    xhr.onerror = () => reject(new RelayError('Network error', 0))
    xhr.onabort = () => reject(new Error('aborted'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })
}

async function uploadViaServer(body: File, opts: UploadOptions): Promise<UploadResult> {
  const { onProgress, signal } = opts
  let lastError: UploadError | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    let stalled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        stalled = true
        controller.abort()
      }, ms)
    }
    const onUserAbort = () => controller.abort()
    signal?.addEventListener('abort', onUserAbort)
    const startedAt = Date.now()
    try {
      onProgress?.(0, attempt === 1 ? 'uploading' : 'retrying')
      arm(STALL_MS)
      const res = await relayOnce(
        body,
        controller.signal,
        (pct) => onProgress?.(pct, 'uploading'),
        (allSent) => arm(allSent ? 60_000 : STALL_MS), // after the last byte the server needs a moment to save it
      )
      onProgress?.(100, 'uploading')
      return res
    } catch (err) {
      if (signal?.aborted) throw new UploadError('Upload cancelled.', false)
      console.warn(`[upload] server relay attempt ${attempt} failed after ${Date.now() - startedAt}ms`, err)
      if (err instanceof RelayError && err.status === 401) {
        throw new UploadError('Your session has expired. Refresh the page and sign in again.', false)
      }
      if (err instanceof RelayError && err.status >= 400 && err.status < 500) {
        throw new UploadError(err.message, false) // the server said no for a reason retrying will not change
      }
      lastError = stalled
        ? new UploadError('The upload stalled. Check your connection and try again.')
        : err instanceof RelayError && err.status >= 500
          ? new UploadError(err.message)
          : friendlyUploadError(err)
      if (attempt < MAX_ATTEMPTS) {
        onProgress?.(-1, 'retrying')
        await new Promise((r) => setTimeout(r, 600 * attempt))
        if (signal?.aborted) throw new UploadError('Upload cancelled.', false)
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onUserAbort)
    }
  }
  throw lastError ?? new UploadError('Upload failed. Please try again.')
}

export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<UploadResult> {
  const { onProgress, signal, compress = true } = opts
  const cancelled = () => new UploadError('Upload cancelled.', false)
  if (signal?.aborted) throw cancelled()

  let body = file
  if (opts.direct) return await uploadDirect(file, opts)
  if (compress && isImageFile(file)) {
    onProgress?.(0, 'preparing')
    body = await prepareImage(file)
    if (signal?.aborted) throw cancelled()
  }

  // Normal-size files: through our own server (reliable, real progress, and it reports Blob's actual error).
  let relayError: UploadError | null = null
  if (body.size <= RELAY_MAX_BYTES) {
    try {
      return await uploadViaServer(body, opts)
    } catch (err) {
      if (signal?.aborted || (err instanceof UploadError && /cancelled|session has expired/.test(err.message))) throw err
      relayError = err instanceof UploadError ? err : friendlyUploadError(err)
      onProgress?.(-1, 'retrying') // one last try, straight to Blob
    }
  }

  try {
    return await uploadDirect(body, opts, relayError ? 1 : MAX_ATTEMPTS)
  } catch (err) {
    throw relayError ?? err // the server's message is the more useful one
  }
}

// Straight from the browser to Blob (needed for big files; Vercel limits what our server can receive).
async function uploadDirect(body: File, opts: UploadOptions, maxAttempts = MAX_ATTEMPTS): Promise<UploadResult> {
  const { onProgress, signal } = opts
  const cancelled = () => new UploadError('Upload cancelled.', false)

  let lastError: UploadError | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const withProgress = attempt === 1 && !streamingProgressBroken
    const controller = new AbortController()
    let stalled = false
    let gotProgress = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        stalled = true
        controller.abort()
      }, ms)
    }
    const onUserAbort = () => controller.abort()
    signal?.addEventListener('abort', onUserAbort)
    const startedAt = Date.now()

    try {
      // -1 means "no percentage available": the bar pulses instead of filling.
      onProgress?.(withProgress ? 0 : -1, attempt === 1 ? 'uploading' : 'retrying')
      arm(withProgress ? (opts.stallMs ?? STALL_MS) : plainTimeoutMs(body.size))
      const blob = await upload(opts.pathname ?? body.name, body, {
        access: 'public',
        handleUploadUrl: opts.handleUploadUrl ?? '/api/upload',
        ...(opts.clientPayload ? { clientPayload: opts.clientPayload } : {}),
        contentType: body.type || 'application/octet-stream',
        multipart: body.size > MULTIPART_ABOVE,
        abortSignal: controller.signal,
        ...(withProgress
          ? {
              onUploadProgress: (e: { percentage: number }) => {
                gotProgress = true
                arm(opts.stallMs ?? STALL_MS)
                onProgress?.(Math.min(100, Math.round(e.percentage)), 'uploading')
              },
            }
          : {}),
      })
      // Worked without the progress stream after the streaming path stalled: stop using it.
      if (!withProgress && attempt > 1 && (lastError?.message.includes('stalled') || lastError?.message.includes('did not respond'))) streamingProgressBroken = true
      onProgress?.(100, 'uploading')
      return { url: blob.url, name: body.name }
    } catch (err) {
      if (signal?.aborted) throw cancelled()
      console.warn(`[upload] attempt ${attempt} (${withProgress ? 'with progress' : 'plain'}) failed after ${Date.now() - startedAt}ms`, err)
      lastError = stalled
        ? new UploadError(
            gotProgress || !withProgress
              ? 'The upload stalled. Check your connection and try again.'
              : 'The upload server did not respond. Check your connection and try again.',
          )
        : friendlyUploadError(err)
      if (!lastError.retryable) throw lastError
      if (attempt < maxAttempts) {
        onProgress?.(-1, 'retrying')
        await sleep(600 * attempt)
        if (signal?.aborted) throw cancelled()
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onUserAbort)
    }
  }
  throw lastError ?? new UploadError('Upload failed. Please try again.')
}
