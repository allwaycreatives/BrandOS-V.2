import { createHash, randomBytes } from 'crypto'

// Server-only helpers for galleries.

export const newGalleryToken = () => randomBytes(18).toString('base64url')

export const hashPasscode = (token: string, passcode: string) =>
  createHash('sha256').update(`${token}:${passcode.trim()}`).digest('hex')

export const unlockCookieName = (token: string) => `gal_${token.slice(0, 12)}`
export const unlockCookieValue = (token: string, passcodeHash: string) =>
  createHash('sha256').update(`unlock:${token}:${passcodeHash}`).digest('hex')

/** Only accept files that really live in this gallery's folder in our Blob storage. */
export function isGalleryBlobUrl(url: string | null | undefined, galleryId: string) {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com') && decodeURIComponent(u.pathname).startsWith(`/galleries/${galleryId}/`)
  } catch {
    return false
  }
}
