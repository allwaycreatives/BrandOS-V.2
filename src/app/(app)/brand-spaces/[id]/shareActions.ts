'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

// Only the workspace owner can publish or unpublish the brand guide link.
async function requireOwner(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') throw new Error('Only the workspace owner can share the brand guide.')
  return access.brandSpace
}

export async function enableBrandShare(brandSpaceId: string) {
  const brand = await requireOwner(brandSpaceId)
  if (brand.shareToken) return { token: brand.shareToken }
  const token = randomBytes(18).toString('base64url')
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { shareToken: token } })
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
  return { token }
}

export async function disableBrandShare(brandSpaceId: string) {
  await requireOwner(brandSpaceId)
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { shareToken: null } })
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
}
