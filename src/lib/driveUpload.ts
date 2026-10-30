// Browser-side upload straight into Google Drive using Google's "resumable upload" protocol:
// the file is sent in chunks, and if the connection drops it carries on from where Google got to.

const UPLOAD_URL = process.env.NEXT_PUBLIC_GOOGLE_UPLOAD_URL || 'https://www.googleapis.com/upload/drive/v3/files'
export const DRIVE_CHUNK = 16 * 1024 * 1024 // must be a multiple of 256 KB
const MAX_FAILS = 8

export class DriveUploadError extends Error {
  constructor(message: string, public reconnect = false) {
    super(message)
  }
}

export type DriveSession = {
  folderId: () => Promise<string>
  previewsId: () => Promise<string>
  token: (forceNew?: boolean) => Promise<string>
}

// Asks Brand Console for a one-hour key to this gallery's Drive folder (and refreshes it when it runs out).
export function createDriveSession(galleryId: string): DriveSession {
  type Info = { accessToken: string; folderId: string; previewsId: string; at: number }
  let info: Info | null = null
  let pending: Promise<Info> | null = null
  const load = async (force: boolean): Promise<Info> => {
    if (!force && info && Date.now() - info.at < 45 * 60 * 1000) return info
    if (!pending) {
      pending = (async (): Promise<Info> => {
        const res = await fetch('/api/google/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ galleryId }) })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new DriveUploadError(j.error || 'Could not get permission to use Google Drive.', !!j.reconnect)
        const fresh: Info = { accessToken: j.accessToken, folderId: j.folderId, previewsId: j.previewsId, at: Date.now() }
        info = fresh
        return fresh
      })().finally(() => {
        pending = null
      })
    }
    return pending
  }
  return {
    folderId: async () => (await load(false)).folderId,
    previewsId: async () => (await load(false)).previewsId,
    token: async (forceNew = false) => (await load(forceNew)).accessToken,
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

type PutResult = { status: number; range: string | null; body: string }

function putChunk(location: string, token: string, data: Blob | null, start: number, endExclusive: number, total: number, onSent?: (bytes: number) => void): Promise<PutResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', location)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Range', data ? `bytes ${start}-${endExclusive - 1}/${total}` : `bytes */${total}`)
    xhr.upload.onprogress = (e) => onSent?.(e.loaded)
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader('Range'), body: xhr.responseText })
    xhr.onerror = () => resolve({ status: 0, range: null, body: '' })
    xhr.ontimeout = () => resolve({ status: 0, range: null, body: '' })
    xhr.send(data)
  })
}

const nextOffset = (range: string | null) => {
  const m = range && /bytes=0-(\d+)/.exec(range)
  return m ? Number(m[1]) + 1 : 0
}

/** Uploads one file or blob into a Drive folder and returns the new file's Drive id. */
export async function driveUpload(
  blob: Blob,
  opts: { name: string; mimeType: string; parentId: string; session: DriveSession; onProgress?: (percent: number) => void },
): Promise<string> {
  const { session, onProgress } = opts
  const total = blob.size
  if (total === 0) throw new DriveUploadError('This file is empty.')

  const start = async (): Promise<string> => {
    for (let attempt = 0; ; attempt++) {
      const token = await session.token(attempt > 0)
      const res = await fetch(`${UPLOAD_URL}?uploadType=resumable&fields=id`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': opts.mimeType, 'X-Upload-Content-Length': String(total) },
        body: JSON.stringify({ name: opts.name, parents: [opts.parentId], mimeType: opts.mimeType }),
      }).catch(() => null)
      const loc = res?.headers.get('Location')
      if (res?.ok && loc) return loc
      if (attempt >= 3) throw new DriveUploadError(res?.status === 403 ? 'Google Drive refused the upload (is it full?).' : 'Could not start the upload to Google Drive.')
      await wait(800 * (attempt + 1))
    }
  }

  let location = await start()
  let offset = 0
  let fails = 0
  for (;;) {
    const end = Math.min(offset + DRIVE_CHUNK, total)
    const token = await session.token()
    const r = await putChunk(location, token, blob.slice(offset, end), offset, end, total, (sent) => onProgress?.(Math.min(99, Math.round(((offset + sent) / total) * 100))))

    if (r.status === 200 || r.status === 201) {
      try {
        const id = JSON.parse(r.body).id as string
        if (id) {
          onProgress?.(100)
          return id
        }
      } catch {}
      throw new DriveUploadError('Google Drive did not confirm the upload.')
    }
    if (r.status === 308) {
      fails = 0
      offset = nextOffset(r.range)
      if (offset >= total) offset = Math.max(0, total - 1) // Google has everything: ask it to finish
      onProgress?.(Math.min(99, Math.round((offset / total) * 100)))
      continue
    }

    // Something went wrong: expired key, dropped connection, or Google hiccup.
    if (++fails > MAX_FAILS) throw new DriveUploadError(r.status === 403 ? 'Google Drive refused the upload (is it full?).' : 'The upload to Google Drive kept failing. Check your connection and retry.')
    if (r.status === 401) await session.token(true)
    if (r.status === 404 || r.status === 410) {
      location = await start() // the upload slot expired: start again
      offset = 0
      continue
    }
    await wait(Math.min(15000, 700 * 2 ** fails))
    // ask Google how much it already has, then carry on from there
    const q = await putChunk(location, await session.token(), null, 0, 0, total)
    if (q.status === 200 || q.status === 201) {
      try {
        const id = JSON.parse(q.body).id as string
        if (id) return id
      } catch {}
    } else if (q.status === 308) offset = nextOffset(q.range)
  }
}
