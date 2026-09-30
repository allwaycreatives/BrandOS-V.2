'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'

// The role comes from the invite stored on the server, never from the browser.
export async function acceptInvite(token: string): Promise<{ brandSpaceId: string } | { error: string }> {
  const invite = await db.brandSpaceInvite.findUnique({ where: { token } }).catch(() => null)
  if (!invite || invite.revokedAt) return { error: 'This invite link is no longer valid.' }

  const { user, organizationId } = await getOrCreateCurrentUser()

  const brandSpace = await db.brandSpace.findUnique({ where: { id: invite.brandSpaceId } })
  if (!brandSpace) return { error: 'This invite link is no longer valid.' }

  // Owners of the workspace already have full access; don't add a lesser role.
  if (brandSpace.organizationId === organizationId) return { brandSpaceId: brandSpace.id }

  const existing = await db.brandSpaceAccess
    .findUnique({ where: { brandSpaceId_userId: { brandSpaceId: brandSpace.id, userId: user.id } } })
    .catch(() => null)

  if (!existing) {
    await db.brandSpaceAccess.create({
      data: { brandSpaceId: brandSpace.id, userId: user.id, role: invite.role },
    })
  }

  return { brandSpaceId: brandSpace.id }
}
