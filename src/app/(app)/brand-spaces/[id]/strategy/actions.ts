'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { parseStrategy, type Strategy } from '@/lib/strategy'

// Saves the brand's content strategy. Owner and team only; whatever is sent is cleaned before it is stored.
export async function saveStrategy(brandSpaceId: string, data: Strategy): Promise<{ ok: boolean; error?: string }> {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') return { ok: false, error: 'You do not have access to change this.' }

  const clean = parseStrategy(data)
  // A series can only belong to a pillar that exists.
  const pillarNames = new Set(clean.pillars.map((p) => p.name))
  clean.series = clean.series.map((s) => ({ ...s, pillar: pillarNames.has(s.pillar) ? s.pillar : '' }))

  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { strategy: clean as unknown as object } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/strategy`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
  return { ok: true }
}
