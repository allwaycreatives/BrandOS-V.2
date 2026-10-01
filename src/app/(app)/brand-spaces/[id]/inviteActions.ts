'use server'

import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'

// The owner can always create invite links; a team member only if the owner switched
// "can invite" on for them. Only the two safe roles are possible. Re-uses a live link.
export async function createInvite(
  brandSpaceId: string,
  role: 'client' | 'team_member'
): Promise<{ token: string } | { error: string }> {
  if (role !== 'client' && role !== 'team_member') return { error: 'Invalid role.' }

  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || !access.canInvite) return { error: 'You do not have permission to invite people.' }

  const existing = await db.brandSpaceInvite.findFirst({
    where: { brandSpaceId, role, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return { token: existing.token }

  const { user } = await getOrCreateCurrentUser()
  const invite = await db.brandSpaceInvite.create({
    data: { brandSpaceId, role, createdById: user.id, token: randomBytes(24).toString('base64url') },
  })
  return { token: invite.token }
}
