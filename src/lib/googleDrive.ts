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
