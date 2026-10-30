// Small helpers that are safe to use in the browser.

export type GalleryKind = 'image' | 'video' | 'file'

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|mxf|mts)$/i
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|tiff?|bmp)$/i

export function kindOf(contentType: string, name: string): GalleryKind {
  const t = (contentType || '').toLowerCase()
  if (t.startsWith('image/')) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (VIDEO_EXT.test(name)) return 'video'
  if (IMAGE_EXT.test(name)) return 'image'
  return 'file'
}

export function formatBytes(n: number): string {
  if (!n || n < 1) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  const v = n / Math.pow(1024, i)
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
}

/** File names that are safe inside a storage path. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, '_').trim()
  return (cleaned || 'file').slice(0, 180)
}

// Files served by Brand Console (from Google Drive) use dl=1; files in Brand Console storage use download=1.
export const downloadUrlOf = (url: string) => url + (url.includes('?') ? '&' : '?') + (url.startsWith('/api/gallery/') ? 'dl=1' : 'download=1')
export const isServedByBrandOS = (url: string) => url.startsWith('/api/gallery/')

export const naturalSort = <T extends { name: string }>(items: T[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

/** Turns "El Shaddai Falcons · Spelling Bee 2026" into "el-shaddai-falcons-spelling-bee-2026". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '')
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])$/
export function checkSlug(raw: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = raw.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'Use 3 to 60 letters, numbers or dashes, with no spaces. For example: spelling-bee-2026' }
  if (slug.includes('--')) return { ok: false, error: 'Please use single dashes between words.' }
  return { ok: true, slug }
}
