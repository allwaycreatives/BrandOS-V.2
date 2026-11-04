import { accessTokenFor, DRIVE_API, DriveAuthError, tokenInfo } from '@/lib/googleDrive'

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
  let lastToken = ''
  const ask = async (force: boolean) => {
    lastToken = await accessTokenFor(conn, force)
    const start = `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`
    const headers: Record<string, string> = { authorization: `Bearer ${lastToken}`, ...(range ? { range } : {}) }
    let res = await fetch(start, { headers, redirect: 'manual' })
    // For a big file Google may hand the download to another address. A plain redirect would silently drop our key on the way
    // (which is how a perfectly good key ends up as "401 authError"), so follow it ourselves and keep the key for Google's API hosts.
    for (let hops = 0; hops < 3 && res.status >= 300 && res.status < 400; hops++) {
      const loc = res.headers.get('location')
      if (!loc) break
      res.body?.cancel().catch(() => {})
      const next = new URL(loc, start)
      res = await fetch(next, { headers: /(^|\.)googleapis\.com$/.test(next.hostname) ? headers : range ? { range } : {}, redirect: 'manual' })
    }
    return res
  }

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
    console.error('[drive-stream] could not use the Google connection:', (e as Error).message)
    if (e instanceof DriveAuthError) return text(502, 'Google Drive needs to be reconnected by its owner (Google no longer accepts the saved connection)')
    return text(502, 'Google Drive is not reachable right now (could not connect)')
  }
  if (up.status === 416) return new Response(null, { status: 416, headers: { 'content-range': up.headers.get('content-range') || '*/0', 'cache-control': 'no-store' } })
  if (!up.ok && up.status !== 206) {
    const reason = await why(up)
    // when Google keeps rejecting the key, say what Google thinks of it (valid? has the Drive permission?)
    const extra = up.status === 401 ? `; ${await tokenInfo(lastToken)}` : ''
    console.error(`[drive-stream] Google answered ${up.status} ${reason} (range: ${range || 'none'})${extra}`)
    return text(up.status === 404 || up.status === 403 ? 404 : 502, `Google Drive could not provide this file (Google said ${up.status}${reason ? `: ${reason}` : ''}${extra})`)
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
