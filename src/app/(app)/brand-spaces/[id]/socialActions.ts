'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { MAX_SOCIAL_LINKS, normalizeSocial, type SocialLink } from '@/lib/social'

// Saves the brand's social links. Owner and team only. Each entry may be a pasted link or just an @handle.
export async function saveSocialLinks(brandSpaceId: string, entries: { platform: string; input: string }[]): Promise<{ ok: boolean; error?: string }> {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') return { ok: false, error: 'You do not have access to change this.' }

  const links: SocialLink[] = []
  for (const e of (entries ?? []).slice(0, MAX_SOCIAL_LINKS)) {
    if (!e || !String(e.input ?? '').trim()) continue // a blank row is just ignored
    const link = normalizeSocial(String(e.platform), String(e.input))
    if (!link) return { ok: false, error: `The ${e.platform} link does not look right. Paste the full link or just the @handle.` }
    links.push(link)
  }
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { socialLinks: links as unknown as object } })
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
  return { ok: true }
}
