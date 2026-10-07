// Deliverables are links, not uploaded files. This turns a link into the best way to show it.

export function safeUrl(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export type Embed = { kind: 'youtube' | 'vimeo' | 'drive' | 'image' | 'link'; src: string; host: string }

export function getEmbed(url: string): Embed {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { kind: 'link', src: url, host: url }
  }
  const host = u.hostname.replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1]
    if (id) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}`, host }
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = u.searchParams.get('v')
    const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/)
    const id = v || (m ? m[2] : '')
    if (id) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}`, host }
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.match(/^\/(\d+)/)?.[1]
    if (id) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}`, host }
  }
  if (host === 'drive.google.com') {
    // The file must be shared as "Anyone with the link can view" or the client sees a Google access page.
    const id = u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || ((u.pathname === '/open' || u.pathname === '/uc') && u.searchParams.get('id')) || ''
    if (id) return { kind: 'drive', src: `https://drive.google.com/file/d/${id}/preview`, host }
  }
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(u.pathname)) return { kind: 'image', src: url, host }
  return { kind: 'link', src: url, host }
}

// Short vertical video (Reels, TikTok, Shorts) is shown in a 9:16 frame; everything else in a wide frame.
export function isVerticalPost(platform: string, url: string): boolean {
  if (/youtube\.com\/shorts\//i.test(url)) return true
  return ['Instagram', 'TikTok'].includes(platform)
}
