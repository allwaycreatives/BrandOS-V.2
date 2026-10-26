import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { authUrl, driveConfigured } from '@/lib/googleDrive'

// Step 1 of connecting Google Drive: send the person to Google's permission screen.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const back = (url.searchParams.get('returnTo') || '/').startsWith('/') ? url.searchParams.get('returnTo') || '/' : '/'
  if (!driveConfigured()) return NextResponse.redirect(new URL(`${back}${back.includes('?') ? '&' : '?'}drive=notconfigured`, origin))
  await getOrCreateCurrentUser() // must be signed in

  const state = randomBytes(18).toString('base64url')
  const res = NextResponse.redirect(authUrl(origin, state))
  res.cookies.set('g_oauth', JSON.stringify({ s: state, r: back }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 600, path: '/api/google' })
  return res
}
