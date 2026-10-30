/* Brand Console service worker v2: works offline.
 *  - App files (_next/static) are cached forever (cache-first).
 *  - Pages are network-first (falls back to the last copy you loaded). Pages are also
 *    pre-loaded in the background so they open even if you never visited them offline.
 *  - Changes made offline (server actions) are saved in a queue on the device and sent
 *    when the connection is back. */
const STATIC = 'brandos-static-v3'
const PAGES = 'brandos-pages-v3'
const IMAGES = 'brandos-images-v3'
const KEEP = [STATIC, PAGES, IMAGES]
const OFFLINE_URL = '/offline.html'
const NAV_TIMEOUT = 4000
const MAX_PAGES = 250
const MAX_IMAGES = 200
const MAX_CACHED_IMAGE = 6 * 1024 * 1024 // never keep big originals in the offline cache

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC).then(async (c) => {
      await c.add(OFFLINE_URL)
      await Promise.all(['/manifest.json', '/aw-logo.png', '/icon.png', '/icon-192.png', '/icon-512.png', '/brand/full-onDark.png', '/brand/full-onLight.png', '/brand/icon-onDark.png', '/brand/icon-onLight.png', '/brand/icon-b.png', '/brand/icon-c-onDark.png', '/brand/icon-c-onLight.png', '/brand/full-b.png', '/brand/full-c-onDark.png', '/brand/full-c-onLight.png'].map((u) => c.add(u).catch(() => {})))
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n)))
      await self.clients.claim()
    })()
  )
})

/* ---------- tiny IndexedDB queue ---------- */
function idb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('brandos-offline', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('queue', { keyPath: 'id', autoIncrement: true })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
async function tx(mode, fn) {
  const db = await idb()
  return new Promise((resolve, reject) => {
    const t = db.transaction('queue', mode)
    const out = fn(t.objectStore('queue'))
    t.oncomplete = () => { db.close(); resolve(out && out.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}
const qAdd = (item) => tx('readwrite', (s) => s.add(item))
const qAll = () => tx('readonly', (s) => s.getAll())
const qDel = (id) => tx('readwrite', (s) => s.delete(id))
const qPut = (item) => tx('readwrite', (s) => s.put(item))

async function notify() {
  let items = []
  try { items = await qAll() } catch (e) {}
  const msg = { type: 'queue', count: items.length, failed: items.filter((i) => i.attempts >= 10).length }
  const all = await self.clients.matchAll({ includeUncontrolled: true })
  all.forEach((c) => c.postMessage(msg))
}

/* ---------- helpers ---------- */
const isSameOrigin = (url) => url.origin === self.location.origin
// Next's page files have [id] in their names. Browsers ask for them as %5Bid%5D, so always store/look up that one form.
function norm(href) {
  const u = new URL(href, self.location.origin)
  u.pathname = u.pathname.replace(/\[/g, '%5B').replace(/\]/g, '%5D')
  return u.href
}
async function trim(cacheName, max) {
  const c = await caches.open(cacheName)
  const keys = await c.keys()
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i])
}
function timeout(ms) {
  return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
}

/* ---------- fetch routing ---------- */
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Changes made through server actions
  if (request.method === 'POST' && request.headers.has('next-action') && isSameOrigin(url)) {
    event.respondWith(handleAction(request))
    return
  }
  if (request.method !== 'GET') return

  // Cross-origin: board pictures + the sign-in library, so they still show offline
  if (!isSameOrigin(url)) {
    if (request.destination === 'image' && /blob\.vercel-storage\.com$/.test(url.hostname)) {
      event.respondWith(cachedImage(request))
    } else if (request.destination === 'script' && /clerk/i.test(url.hostname)) {
      event.respondWith(cacheFirst(request, STATIC))
    }
    return
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/gallery/')) return
  if (url.pathname.startsWith('/_next/static/') || /\.(woff2?|ttf|otf)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC))
    return
  }
  if (url.pathname.startsWith('/_next/image') || /\.(png|jpe?g|webp|gif|svg|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGES, MAX_IMAGES))
    return
  }
  if (url.pathname.startsWith('/_next/')) return

  // Next's in-app page data (RSC) is left alone on purpose: offline it fails and Next
  // then does a normal page load, which is served from the saved pages below.
  if (request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return
  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request))
  }
})

async function cacheFirst(request, name) {
  const c = await caches.open(name)
  const key = new URL(request.url).origin === self.location.origin ? norm(request.url) : request.url
  const hit = (await c.match(key, { ignoreSearch: true, ignoreVary: true })) || (await c.match(request, { ignoreSearch: true, ignoreVary: true }))
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) c.put(key, res.clone())
  return res
}

async function staleWhileRevalidate(request, name, max) {
  const c = await caches.open(name)
  const hit = (await c.match(request, { ignoreVary: true })) || (await caches.match(request, { ignoreVary: true }))
  const net = fetch(request)
    .then((res) => { if (res.ok) { c.put(request, res.clone()); if (max) trim(name, max) } return res })
    .catch(() => null)
  if (hit) return hit
  return (await net) || Response.error()
}

async function cachedImage(request) {
  const c = await caches.open(IMAGES)
  const hit = await c.match(request.url)
  if (hit) return hit
  try {
    // re-ask with CORS so the answer is a normal (not opaque) response we can store
    const res = await fetch(request.url, { mode: 'cors' })
    if (res.ok && Number(res.headers.get('content-length') || 0) <= MAX_CACHED_IMAGE) { c.put(request.url, res.clone()); trim(IMAGES, MAX_IMAGES) }
    return res
  } catch (e) {
    try { return await fetch(request) } catch (e2) { return Response.error() }
  }
}

async function pageNetworkFirst(request) {
  const c = await caches.open(PAGES)
  const key = new URL(request.url).href
  const network = fetch(request).then((res) => {
    // only keep real pages, never a sign-in redirect
    if (res.ok && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
      c.put(key, res.clone()); trim(PAGES, MAX_PAGES)
    }
    return res
  })
  try {
    return await Promise.race([network, timeout(NAV_TIMEOUT)])
  } catch (e) {
    const hit = await c.match(key, { ignoreVary: true })
    if (hit) { network.catch(() => {}); return hit }
    try { return await network } catch (e2) {}
    return (await caches.match(OFFLINE_URL)) || Response.error()
  }
}

/* ---------- offline changes ---------- */
async function handleAction(request) {
  let copy
  try { copy = request.clone() } catch (e) { return fetch(request) }
  try {
    return await fetch(request)
  } catch (e) {
    // offline: save the change on the device and pretend it went through
    try {
      const headers = {}
      copy.headers.forEach((v, k) => { headers[k] = v })
      const body = await copy.arrayBuffer()
      await qAdd({ url: copy.url, headers, body, at: Date.now(), attempts: 0 })
      await notify()
      return new Response('', { status: 200, headers: { 'content-type': 'text/plain', 'x-brandos-queued': '1' } })
    } catch (e2) {
      return Response.error()
    }
  }
}

let replaying = false
async function replay() {
  if (replaying) return
  replaying = true
  try {
    const items = (await qAll()).sort((a, b) => a.id - b.id)
    for (const it of items) {
      if (it.attempts >= 10) continue
      let ok = false
      try {
        const res = await fetch(it.url, { method: 'POST', headers: it.headers, body: it.body, credentials: 'include', redirect: 'manual' })
        ok = res.ok && (res.headers.get('content-type') || '').includes('text/x-component')
      } catch (e) {
        break // still offline: stop and try again later
      }
      if (ok) await qDel(it.id)
      else { it.attempts++; await qPut(it); break } // keep order: do not skip ahead
    }
  } finally {
    replaying = false
    await notify()
  }
}

/* ---------- pre-loading pages so they open offline ---------- */
const SKIP = /^\/(api|sign-in|sign-up|share|invite|review|brief|discovery|gallery)(\/|$)|\/(delete|import)(\/|$)/
async function warm(urls) {
  const c = await caches.open(PAGES)
  const seen = new Set()
  let queue = urls.map((u) => ({ u, d: 0 }))
  let done = 0
  const images = new Set()
  const assets = new Set()
  const why = []
  const say = async (m) => (await self.clients.matchAll({ includeUncontrolled: true })).forEach((cl) => cl.postMessage(m))
  while (queue.length && done < 70) {
    const batch = queue.splice(0, 4)
    await Promise.all(batch.map(async ({ u, d }) => {
      const url = new URL(u, self.location.origin)
      if (!isSameOrigin(url) || SKIP.test(url.pathname) || seen.has(url.pathname)) return
      seen.add(url.pathname)
      try {
        const res = await fetch(url.href, { credentials: 'include', headers: { Accept: 'text/html' } })
        if (!res.ok || res.redirected || !(res.headers.get('content-type') || '').includes('text/html')) {
          if (why.length < 4) why.push(url.pathname + ': ' + (res.redirected ? 'redirected to ' + new URL(res.url).pathname : res.status + ' ' + (res.headers.get('content-type') || '').split(';')[0]))
          return
        }
        const html = await res.clone().text()
        await c.put(url.href, res)
        done++
        if (d < 3) {
          const re = /href="(\/[^"#?]*)"/g
          let m
          while ((m = re.exec(html))) if (!seen.has(m[1]) && !SKIP.test(m[1]) && !m[1].startsWith('/_next') && !/\.[a-z0-9]{2,5}$/i.test(m[1])) queue.push({ u: m[1], d: d + 1 })
        }
        const are = /(?:\/_next\/)?(static\/(?:chunks|css|media)\/[^"'\s\\<>,]+?\.(?:js|css|woff2?))/g
        let am
        while ((am = are.exec(html)) && assets.size < 400) assets.add('/_next/' + am[1].replace(/&amp;/g, '&'))
        const cre = /src="(https:\/\/[^"]*clerk[^"]*\.js)"/gi
        let cm
        while ((cm = cre.exec(html))) assets.add(cm[1])
        const ire = /(https:\/\/[a-z0-9.-]+blob\.vercel-storage\.com\/[^"'\s\\)<]+)/g
        let im
        while ((im = ire.exec(html)) && images.size < 80) images.add(im[1].replace(/&amp;/g, '&'))
      } catch (e) { if (why.length < 4) why.push(url.pathname + ': ' + (e && e.message)) }
    }))
    await say({ type: 'warm-progress', pages: done })
  }
  const sc = await caches.open(STATIC)
  const list = Array.from(assets)
  for (let i = 0; i < list.length; i += 6) {
    await Promise.all(list.slice(i, i + 6).map(async (a) => {
      try {
        const cross = !a.startsWith('/')
        const abs = new URL(a, self.location.origin)
        const key = cross ? abs.href : norm(abs.href)
        let res = await sc.match(key, { ignoreSearch: true, ignoreVary: true })
        if (!res) {
          res = await fetch(key, cross ? { mode: 'cors' } : undefined)
          if (!res.ok) return
          await sc.put(key, res.clone())
        }
        if (/\.css$/.test(abs.pathname)) {
          const css = await res.clone().text()
          const fre = /url\(\s*["']?([^)"']+\.woff2?)/g
          let fm
          while ((fm = fre.exec(css))) {
            const f = norm(new URL(fm[1], abs.href).href)
            if (!(await sc.match(f, { ignoreSearch: true, ignoreVary: true }))) { const fr = await fetch(f); if (fr.ok) await sc.put(f, fr) }
          }
        }
      } catch (e) {}
    }))
  }
  trim(PAGES, MAX_PAGES)
  const ic = await caches.open(IMAGES)
  for (const src of images) {
    try {
      if (await ic.match(src)) continue
      const res = await fetch(src, { mode: 'cors' })
      if (res.ok && Number(res.headers.get('content-length') || 0) <= MAX_CACHED_IMAGE) await ic.put(src, res)
      else if (res.body) res.body.cancel()
    } catch (e) {}
  }
  trim(IMAGES, MAX_IMAGES)
  await say({ type: 'warmed', pages: done, why })
}

self.addEventListener('message', (event) => {
  const d = event.data || {}
  if (d.type === 'replay') event.waitUntil(replay())
  else if (d.type === 'warm') event.waitUntil(warm(d.urls || []))
  else if (d.type === 'status') event.waitUntil(notify())
  else if (d.type === 'clear-pages') event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(IMAGES)]))
})
