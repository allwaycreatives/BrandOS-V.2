'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { hashPasscode, unlockCookieName, unlockCookieValue } from '@/lib/gallery'

// Checks the passcode a client typed and, if right, remembers it on their device for 30 days.
export async function unlockGallery(token: string, passcode: string): Promise<{ ok: boolean }> {
  const g = await db.gallery.findUnique({ where: { shareToken: token } }).catch(() => null)
  if (!g || !g.published || !g.passcodeHash) return { ok: false }
  if (hashPasscode(token, passcode) !== g.passcodeHash) {
    await new Promise((r) => setTimeout(r, 600)) // slows down guessing
    return { ok: false }
  }
  (await cookies()).set(unlockCookieName(token), unlockCookieValue(token, g.passcodeHash), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/gallery',
  })
  return { ok: true }
}
