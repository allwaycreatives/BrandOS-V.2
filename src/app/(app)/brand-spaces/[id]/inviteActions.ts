'use server'

import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'

// Only the workspace owner ('agency') can create invite links, and only for
// the two safe roles. Re-uses an existing live link for the same role.
export async function createInvite(
  brandSpaceId: string,
  role: 'client' | 'team_member'
): Promise<{ token: string } | { error: string }> {
  if (role !== 'client' && role !== 'team_member') return { error: 'Invalid role.' }

  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') return { error: 'You do not have permission to invite people.' }

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
