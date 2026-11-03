import { accessTokenFor, DRIVE_API } from '@/lib/googleDrive'

// Streams one file from a person's Google Drive to the browser, passing along Range requests
// (so videos can seek and big downloads can be fetched in pieces).

export async function streamDriveFile(
  conn: { id: string; refreshToken: string },
  fileId: string,
  request: Request,
  opts: { contentType: string; cacheControl: string; downloadName?: string },
): Promise<Response> {
  const text = (status: number, message: string) => new Response(message, { status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } })
  const range = request.headers.get('range')
  const ask = async (force: boolean) =>
    fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { authorization: `Bearer ${await accessTokenFor(conn, force)}`, ...(range ? { range } : {}) } })

  // What Google said, in a few words (its error "reason", never ids or keys), so a failure can be understood and logged.
  const why = async (r: Response) => {
    try {
      const j = await r.clone().json()
      return String(j?.error?.errors?.[0]?.reason || j?.error?.status || j?.error?.message || '').slice(0, 80)
    } catch {
      return ''
    }
  }

  let up: Response
  try {
    up = await ask(false)
    if (up.status === 401) up = await ask(true)
    // a busy or hiccuping Google: wait a moment and ask once more
    if (up.status === 429 || up.status >= 500) {
      await new Promise((r) => setTimeout(r, 700))
      up = await ask(false)
    }
  } catch (e) {
    console.error('[drive-stream] could not reach Google Drive:', (e as Error).message)
    return text(502, 'Google Drive is not reachable right now (could not connect)')
  }
  if (up.status === 416) return new Response(null, { status: 416, headers: { 'content-range': up.headers.get('content-range') || '*/0', 'cache-control': 'no-store' } })
  if (!up.ok && up.status !== 206) {
    const reason = await why(up)
    console.error(`[drive-stream] Google answered ${up.status} ${reason} (range: ${range || 'none'})`)
    return text(up.status === 404 || up.status === 403 ? 404 : 502, `Google Drive could not provide this file (Google said ${up.status}${reason ? `: ${reason}` : ''})`)
  }

  const headers = new Headers()
  headers.set('content-type', opts.contentType || up.headers.get('content-type') || 'application/octet-stream')
  headers.set('accept-ranges', 'bytes')
  for (const h of ['content-length', 'content-range']) {
    const v = up.headers.get(h)
    if (v && !up.headers.get('content-encoding')) headers.set(h, v)
  }
  headers.set('cache-control', opts.cacheControl)
  if (opts.downloadName) {
    const ascii = opts.downloadName.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_')
    headers.set('content-disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`)
  }
  return new Response(up.body, { status: up.status === 206 ? 206 : 200, headers })
}
