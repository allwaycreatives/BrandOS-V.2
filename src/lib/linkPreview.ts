import dns from 'dns/promises'
import net from 'net'
import { getEmbed } from './embed'

// What a link card shows: a title and a picture. Saved on the card so the board loads fast and the page is not asked again.
export type LinkMeta = { title?: string; image?: string; kind?: 'video' | 'image' | 'page'; site?: string }

const UA = 'Mozilla/5.0 (compatible; BrandOS-LinkPreview/1.0)'
const clip = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n)

// This server fetches pages on a stranger's behalf, so it must never be pointed at private or internal addresses.
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase()
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb') || l.startsWith('::ffff:')
  }
  return true
}

async function assertPublic(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('port')
  if (u.username || u.password) throw new Error('credentials')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('private')
    return
  }
  const addrs = await dns.lookup(host, { all: true })
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error('private')
}

// Follows up to 3 redirects, checking every hop. Reads at most ~400 KB of a page.
async function fetchHtml(startUrl: string): Promise<{ html: string; url: string } | null> {
  let url = startUrl
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(url)
    await assertPublic(u)
    const res = await fetch(u, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(4000) })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      url = new URL(loc, u).toString()
      continue
    }
    if (!res.ok || !(res.headers.get('content-type') || '').includes('text/html') || !res.body) return null
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < 400_000) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      size += value.length
    }
    reader.cancel().catch(() => {})
    return { html: Buffer.concat(chunks).toString('utf8'), url }
  }
  return null
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export function parseHtml(html: string, pageUrl: string): LinkMeta {
  const tags: Record<string, string> = {}
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0]
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const val = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag)
    const content = val ? (val[1] ?? val[2]) : undefined
    if (key && content && !tags[key]) tags[key] = decode(content)
  }
  const title = tags['og:title'] || tags['twitter:title'] || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '')
  let image: string | undefined
  const rawImg = tags['og:image'] || tags['og:image:url'] || tags['twitter:image'] || tags['twitter:image:src']
  if (rawImg) {
    try {
      const abs = new URL(rawImg, pageUrl)
      if (abs.protocol === 'https:') image = abs.toString()
    } catch {}
  }
  const isVideo = (tags['og:type'] || '').startsWith('video')
  return { title: title ? clip(title, 140) : undefined, image: image && image.length < 1500 ? image : undefined, kind: isVideo ? 'video' : 'page', site: tags['og:site_name'] ? clip(tags['og:site_name'], 60) : undefined }
}

async function oembed(endpoint: string): Promise<{ title?: string; thumbnail_url?: string } | null> {
  try {
    const res = await fetch(endpoint, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

// The one entry point. Never throws: when nothing can be found it returns {} and the card just shows the address.
export async function getLinkPreview(url: string): Promise<LinkMeta> {
  try {
    const e = getEmbed(url)
    if (e.kind === 'image') return { image: url, kind: 'image', site: e.host }

    if (e.kind === 'youtube') {
      const id = e.src.split('/embed/')[1]
      const o = await oembed(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
      return { title: o?.title ? clip(o.title, 140) : undefined, image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, kind: 'video', site: 'YouTube' }
    }
    if (e.kind === 'vimeo') {
      const o = await oembed(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`)
      return { title: o?.title ? clip(o.title, 140) : undefined, image: o?.thumbnail_url?.startsWith('https://') ? o.thumbnail_url : undefined, kind: 'video', site: 'Vimeo' }
    }
    if (e.kind === 'drive') {
      // Works when the file is shared as "Anyone with the link"; otherwise Google gives no picture and the card hides it.
      const id = e.src.match(/\/file\/d\/([\w-]+)/)?.[1]
      return { image: id ? `https://drive.google.com/thumbnail?id=${id}&sz=w480` : undefined, kind: 'page', site: 'Google Drive' }
    }

    const page = await fetchHtml(url)
    return page ? parseHtml(page.html, page.url) : {}
  } catch {
    return {}
  }
}

export const metaToJson = (m: LinkMeta) => JSON.stringify(m)
export function parseMeta(raw: string | null | undefined): LinkMeta {
  if (!raw) return {}
  try {
    const m = JSON.parse(raw)
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}
