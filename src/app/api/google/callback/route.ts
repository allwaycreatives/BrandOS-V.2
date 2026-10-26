import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { encrypt, exchangeCode } from '@/lib/googleDrive'

// Step 2: Google sends the person back here with a one-time code. We swap it for a long-lived key
// and keep it (encrypted) so the person never has to log in to Google again for this.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const raw = request.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith('g_oauth='))?.slice(8)
  let saved: { s: string; r: string } | null = null
  try {
    saved = raw ? JSON.parse(decodeURIComponent(raw)) : null
  } catch {}
  const back = saved?.r && saved.r.startsWith('/') ? saved.r : '/'
  const go = (flag: string) => {
    const res = NextResponse.redirect(new URL(`${back}${back.includes('?') ? '&' : '?'}drive=${flag}`, origin))
    res.cookies.set('g_oauth', '', { path: '/api/google', maxAge: 0 })
    return res
  }

  const code = url.searchParams.get('code')
  if (url.searchParams.get('error') || !code) return go('denied')
  if (!saved || saved.s !== url.searchParams.get('state')) return go('error')

  try {
    const { user } = await getOrCreateCurrentUser()
    const t = await exchangeCode(origin, code)
    const data = { email: t.email || user.email, refreshToken: encrypt(t.refreshToken) }
    await db.googleConnection.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data })
    return go('connected')
  } catch (e) {
    console.warn('[google] connect failed', (e as Error).message)
    return go('error')
  }
}
