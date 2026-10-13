import { safeUrl } from './embed'

// A brand's social media and website links, so "what's their Instagram?" is one tap away.
export const SOCIAL_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'X', 'Threads', 'Pinterest', 'Website', 'Other'] as const
export type SocialLink = { platform: string; url: string }
export const MAX_SOCIAL_LINKS = 12

// Where a bare @handle points, per platform.
const BASES: Record<string, string> = {
  Instagram: 'https://www.instagram.com/',
  TikTok: 'https://www.tiktok.com/@',
  YouTube: 'https://www.youtube.com/@',
  Facebook: 'https://www.facebook.com/',
  LinkedIn: 'https://www.linkedin.com/in/',
  X: 'https://x.com/',
  Threads: 'https://www.threads.net/@',
  Pinterest: 'https://www.pinterest.com/',
}

// Accepts a pasted link ("instagram.com/allway" or "https://...") or just a handle ("@allway"). Returns null if it is neither.
export function normalizeSocial(platform: string, input: string): SocialLink | null {
  if (!(SOCIAL_PLATFORMS as readonly string[]).includes(platform)) return null
  const text = input.trim()
  if (!text) return null
  if (BASES[platform] && /^@?[A-Za-z0-9._-]{1,60}$/.test(text) && !/\.(com|net|org|io|co|app|me)$/i.test(text)) {
    return { platform, url: BASES[platform] + text.replace(/^@/, '') }
  }
  const url = safeUrl(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
  if (!url || !/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(url)) return null
  return { platform, url }
}

// Reads whatever is stored and always returns a safe list.
export function parseSocial(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return []
  const out: SocialLink[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.platform !== 'string' || typeof o.url !== 'string') continue
    const link = (SOCIAL_PLATFORMS as readonly string[]).includes(o.platform) ? normalizeSocial(o.platform, o.url) : null
    if (link) out.push(link)
    if (out.length >= MAX_SOCIAL_LINKS) break
  }
  return out
}

// The short label shown beside the platform name: the handle, or the site's address.
export function handleOf(link: SocialLink): string {
  try {
    const u = new URL(link.url)
    const seg = u.pathname.split('/').filter(Boolean)
    if (link.platform === 'Website' || link.platform === 'Other' || seg.length === 0) return u.hostname.replace(/^www\./, '')
    const last = seg[seg.length - 1].replace(/^@/, '')
    return `@${last}`
  } catch {
    return ''
  }
}
