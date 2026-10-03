'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

async function requireOwner(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') throw new Error('Only the workspace owner can manage the brief link.')
  return access.brandSpace
}

export async function enableBriefLink(brandSpaceId: string) {
  const brand = await requireOwner(brandSpaceId)
  if (brand.intakeToken) return { token: brand.intakeToken }
  const token = randomBytes(18).toString('base64url')
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { intakeToken: token } })
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
  return { token }
}

export async function disableBriefLink(brandSpaceId: string) {
  await requireOwner(brandSpaceId)
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { intakeToken: null } })
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
}
