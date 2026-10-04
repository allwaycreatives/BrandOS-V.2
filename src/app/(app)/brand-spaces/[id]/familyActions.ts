'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

// Links a brand under a shared brand (or unlinks it). One level only: a brand with founders under it
// cannot itself be a founder, and the shared brand must belong to the same workspace.
export async function setBrandParent(brandSpaceId: string, parentId: string | null): Promise<{ ok: boolean; error?: string }> {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') return { ok: false, error: 'Only the workspace owner can link brands.' }

  if (parentId) {
    if (parentId === brandSpaceId) return { ok: false, error: 'A brand cannot be part of itself.' }
    const parent = await db.brandSpace.findUnique({ where: { id: parentId } })
    if (!parent || parent.organizationId !== access.brandSpace.organizationId) return { ok: false, error: 'That brand is not in your workspace.' }
    if (parent.parentId) return { ok: false, error: 'That brand is already part of another one. Pick the top-level brand.' }
    const kids = await db.brandSpace.count({ where: { parentId: brandSpaceId } })
    if (kids > 0) return { ok: false, error: 'This brand has linked brands under it, so it cannot sit under another one.' }
  }

  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { parentId } })
  revalidatePath('/dashboard')
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
  if (parentId) revalidatePath(`/brand-spaces/${parentId}`)
  return { ok: true }
}
