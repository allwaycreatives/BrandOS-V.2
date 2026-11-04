import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

// Server-only helpers for keeping gallery files in a person's own Google Drive.
// Brand Console only gets the "drive.file" permission: it can see just the files and folders it creates itself.

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file openid email'
const AUTH_URL = process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token'
const REVOKE_URL = process.env.GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke'
export const DRIVE_API = process.env.GOOGLE_DRIVE_API_URL || 'https://www.googleapis.com/drive/v3'

export const driveConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export class DriveAuthError extends Error {
  constructor(message = 'Google Drive needs to be connected again.') {
    super(message)
  }
}

/* ---------- encrypted refresh tokens ---------- */
function key() {
  const secret = process.env.GOOGLE_TOKEN_KEY || process.env.CLERK_SECRET_KEY
  if (!secret) throw new Error('No secret available to protect the Google token.')
  return createHash('sha256').update('brandos-drive:' + secret).digest()
}
export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.')
}
export function decrypt(packed: string): string {
  const [iv, tag, enc] = packed.split('.').map((x) => Buffer.from(x, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

/* ---------- sign in ---------- */
export const redirectUriFor = (origin: string) => `${origin}/api/google/callback`

export function authUrl(origin: string, state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUriFor(origin),
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline', // so we get a refresh token and keep working without the person being there
    prompt: 'consent',
    state,
  })
  return `${AUTH_URL}?${q}`
}

export async function exchangeCode(origin: string, code: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', redirect_uri: redirectUriFor(origin), grant_type: 'authorization_code' }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.refresh_token) throw new Error(j.error_description || j.error || 'Google did not return a long-lived connection.')
  let email = ''
  try {
    email = JSON.parse(Buffer.from(String(j.id_token).split('.')[1], 'base64url').toString()).email || ''
  } catch {}
  return { refreshToken: j.refresh_token as string, accessToken: j.access_token as string, expiresIn: Number(j.expires_in) || 3600, email }
}

export async function revokeToken(refreshToken: string) {
  try {
    await fetch(REVOKE_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refreshToken }) })
  } catch {}
}

/* ---------- short-lived access tokens (kept in memory a little while) ---------- */
const cache = new Map<string, { token: string; exp: number }>()

export async function accessTokenFor(conn: { id: string; refreshToken: string }, force = false): Promise<string> {
  const hit = cache.get(conn.id)
  if (!force && hit && hit.exp > Date.now() + 60_000) return hit.token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: decrypt(conn.refreshToken), grant_type: 'refresh_token' }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) {
    cache.delete(conn.id)
    if (j.error === 'invalid_grant' || res.status === 400 || res.status === 401) throw new DriveAuthError()
    throw new Error('Could not reach Google Drive right now.')
  }
  cache.set(conn.id, { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 })
  return j.access_token
}

/* ---------- folders and files ---------- */
async function drive(token: string, path: string, init: RequestInit = {}) {
  return fetch(`${DRIVE_API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } })
}

// Asks Google what it thinks of an access key (is it valid, how long is left, does it include the Drive permission).
// Used only to explain a failure; it never reveals the key itself.
export async function tokenInfo(token: string): Promise<string> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return `Google does not accept the key itself (${j.error_description || j.error || res.status})`
    const scopes = String(j.scope || '')
    const hasDrive = scopes.includes('/auth/drive')
    return `the key is valid for ${Math.round(Number(j.expires_in) || 0)}s and ${hasDrive ? 'includes' : 'is MISSING'} the Drive permission`
  } catch {
    return 'could not check the key'
  }
}

// Is this Google Drive connection working right now? Mirrors what serving a file does: try the saved key, and on a
// rejection ask for a fresh one and try again.
export async function driveHealth(conn: { id: string; refreshToken: string }): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    let token = await accessTokenFor(conn)
    let res = await drive(token, '/about?fields=kind')
    if (res.status === 401) {
      token = await accessTokenFor(conn, true)
      res = await drive(token, '/about?fields=kind')
    }
    if (res.ok) return { ok: true }
    const j = await res.json().catch(() => ({}))
    const reason = String(j?.error?.errors?.[0]?.reason || j?.error?.status || '').slice(0, 60)
    return { ok: false, message: `Google answered ${res.status}${reason ? ` (${reason})` : ''}; ${await tokenInfo(token)}.` }
  } catch (e) {
    if (e instanceof DriveAuthError) return { ok: false, message: 'Google no longer accepts the saved connection (it expired or was withdrawn).' }
    return { ok: false, message: 'Could not reach Google Drive just now.' }
  }
}

// The address Google serves a link-shared file from. The viewer's browser fetches the film from Google itself, so the
// picture does not depend on Brand Console holding a working Google login at that moment, and there is no extra hop.
export const directUrl = (fileId: string) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`

// Lets anyone who has the (unguessable) file link read it. Needs only the "drive.file" permission, because Brand Console made the files.
export async function makeFilesPublic(conn: { id: string; refreshToken: string }, ids: string[]): Promise<{ ok: boolean; problems: string[] }> {
  let token = await accessTokenFor(conn)
  const problems: string[] = []
  for (const id of ids) {
    const post = (t: string) => drive(t, `/files/${encodeURIComponent(id)}/permissions`, { method: 'POST', body: JSON.stringify({ role: 'reader', type: 'anyone', allowFileDiscovery: false }) })
    let res = await post(token)
    if (res.status === 401) {
      token = await accessTokenFor(conn, true)
      res = await post(token)
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      const reason = String(j?.error?.errors?.[0]?.reason || j?.error?.status || '').slice(0, 60)
      console.error(`[drive-share] could not share a file (Google said ${res.status} ${reason})`)
      problems.push(`Google said ${res.status}${reason ? ` (${reason})` : ''}`)
    }
  }
  return { ok: problems.length === 0, problems }
}

export type DriveStep = { label: string; ok: boolean; detail: string; warn?: boolean }
export type DriveTarget = { name: string; id: string | null | undefined; expectedSize?: number }

// Does what serving the video does, step by step, and reports each step in plain words: get a fresh key, does Google accept it,
// can Drive be reached; then for each video file: is it found, is it complete, has Google prepared it for playback, can its bytes be read.
// A "warn" step is something worth knowing that does not mean the connection is broken.
export async function driveDiagnose(conn: { id: string; refreshToken: string }, targets: DriveTarget[] = []): Promise<{ ok: boolean; steps: DriveStep[] }> {
  const steps: DriveStep[] = []
  const add = (label: string, ok: boolean, detail: string, warn = false) => steps.push({ label, ok, detail, warn })
  const done = () => ({ ok: steps.every((s) => s.ok || s.warn), steps })
  let token = ''
  try {
    token = await accessTokenFor(conn, true)
    add('Brand Console gets a fresh key from Google', true, 'Done.')
  } catch (e) {
    add('Brand Console gets a fresh key from Google', false, e instanceof DriveAuthError ? 'Google refused. The saved connection has expired or was withdrawn, so it must be reconnected.' : 'Google could not be reached just now.')
    return done()
  }
  const info = await tokenInfo(token)
  add('Google accepts that key', !/does not accept|could not check/.test(info), info.charAt(0).toUpperCase() + info.slice(1) + '.')
  try {
    const about = await drive(token, '/about?fields=kind')
    add('Google Drive answers', about.ok, about.ok ? 'Done.' : `Google answered ${about.status}.`)
    for (const t of targets) {
      if (!t.id) continue
      const meta = await drive(token, `/files/${encodeURIComponent(t.id)}?fields=name,size,md5Checksum,trashed,videoMediaMetadata(width,height,durationMillis)`)
      const mj = await meta.json().catch(() => ({}))
      const reason = String(mj?.error?.errors?.[0]?.reason || mj?.error?.status || '').slice(0, 60)
      if (!meta.ok) {
        add(`${t.name}: found in Drive`, false, `Google answered ${meta.status}${reason ? ` (${reason})` : ''}.`)
        continue
      }
      const bytes = Number(mj.size) || 0
      add(`${t.name}: found in Drive`, !mj.trashed, mj.trashed ? 'It is in the Drive bin.' : `${mj.name || 'Found'}, ${Math.round(bytes / 1048576)} MB.`)
      if (t.expectedSize && bytes && bytes !== t.expectedSize) add(`${t.name}: the upload is complete`, false, `Drive holds ${bytes.toLocaleString('en')} bytes, but ${t.expectedSize.toLocaleString('en')} were uploaded. The file is incomplete: upload it again.`, true)
      const v = mj.videoMediaMetadata
      if (v && v.durationMillis) {
        const secs = Math.round(Number(v.durationMillis) / 1000)
        add(`${t.name}: Google has prepared it for playback`, true, `${v.width}×${v.height}, ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}.`)
      } else {
        add(`${t.name}: Google has prepared it for playback`, false, 'Not yet. Until Google has processed the video, its own player shows "There was a problem playing this video". Large files can take a while; if it stays like this for hours, Google cannot read the file, and exporting it again as an H.264 MP4 usually fixes that.', true)
      }
      if (mj.md5Checksum) add(`${t.name}: fingerprint (MD5)`, true, `${mj.md5Checksum}. To check the upload is not damaged, compare it with the same file on your computer (Windows: certutil -hashfile "file.mp4" MD5).`)
      const media = await fetch(`${DRIVE_API}/files/${encodeURIComponent(t.id)}?alt=media`, { redirect: 'manual', headers: { authorization: `Bearer ${token}`, range: 'bytes=0-0' } })
      media.body?.cancel().catch(() => {})
      if (media.status >= 300 && media.status < 400) add(`${t.name}: can be read`, true, `Google hands the download to another address (${new URL(media.headers.get('location') || DRIVE_API, DRIVE_API).hostname}); Brand Console follows it.`)
      else add(`${t.name}: can be read`, media.ok, media.ok ? 'Done.' : `Google answered ${media.status}.`)
    }
  } catch {
    add('Google Drive answers', false, 'Google could not be reached just now.')
  }
  return done()
}

export async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const res = await drive(token, '/files?fields=id', { method: 'POST', body: JSON.stringify({ name: name.slice(0, 200), mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || !j.id) throw new Error('Could not create a folder in Google Drive.')
  return j.id
}

export async function folderExists(token: string, id: string): Promise<boolean> {
  const res = await drive(token, `/files/${encodeURIComponent(id)}?fields=id,trashed`)
  if (!res.ok) return false
  const j = await res.json().catch(() => ({}))
  return !!j.id && !j.trashed
}

export async function fileInfo(token: string, id: string): Promise<{ parents?: string[]; size?: string } | null> {
  const res = await drive(token, `/files/${encodeURIComponent(id)}?fields=parents,size`)
  return res.ok ? await res.json().catch(() => null) : null
}

export async function deleteDriveFiles(conn: { id: string; refreshToken: string }, ids: (string | null | undefined)[]) {
  const list = ids.filter((i): i is string => !!i)
  if (!list.length) return
  try {
    const token = await accessTokenFor(conn)
    await Promise.all(list.map((id) => drive(token, `/files/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)))
  } catch (e) {
    console.warn('[gallery] could not delete some files from Google Drive', (e as Error).message)
  }
}
