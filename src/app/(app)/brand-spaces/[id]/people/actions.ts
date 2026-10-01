'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

// Managing people is for the workspace owner only.
async function requireOwner(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') throw new Error('Only the workspace owner can manage people.')
}

const done = (brandSpaceId: string) => revalidatePath(`/brand-spaces/${brandSpaceId}/people`)

export async function setCanInvite(brandSpaceId: string, userId: string, value: boolean) {
  await requireOwner(brandSpaceId)
  const access = await db.brandSpaceAccess.findUnique({ where: { brandSpaceId_userId: { brandSpaceId, userId } } })
  if (!access || access.role === 'client') return
  await db.brandSpaceAccess.update({ where: { brandSpaceId_userId: { brandSpaceId, userId } }, data: { canInvite: value } })
  done(brandSpaceId)
}

export async function setMemberRole(brandSpaceId: string, userId: string, role: 'client' | 'team_member') {
  if (role !== 'client' && role !== 'team_member') return
  await requireOwner(brandSpaceId)
  await db.brandSpaceAccess.update({
    where: { brandSpaceId_userId: { brandSpaceId, userId } },
    data: { role, ...(role === 'client' ? { canInvite: false } : {}) },
  })
  done(brandSpaceId)
}

export async function removeMember(brandSpaceId: string, userId: string) {
  await requireOwner(brandSpaceId)
  await db.brandSpaceAccess.delete({ where: { brandSpaceId_userId: { brandSpaceId, userId } } })
  done(brandSpaceId)
}

export async function revokeInvite(brandSpaceId: string, inviteId: string) {
  await requireOwner(brandSpaceId)
  const invite = await db.brandSpaceInvite.findUnique({ where: { id: inviteId } })
  if (!invite || invite.brandSpaceId !== brandSpaceId) return
  await db.brandSpaceInvite.update({ where: { id: inviteId }, data: { revokedAt: new Date() } })
  done(brandSpaceId)
}
