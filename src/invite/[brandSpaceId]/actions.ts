'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'

export async function acceptInvite(brandSpaceId: string, role: string) {
  const { user } = await getOrCreateCurrentUser()
  const validRole = ['client', 'team_member', 'admin'].includes(role) ? role : 'team_member'

  const existing = await db.brandSpaceAccess
    .findUnique({ where: { brandSpaceId_userId: { brandSpaceId, userId: user.id } } })
    .catch(() => null)

  if (!existing) {
    await db.brandSpaceAccess.create({
      data: { brandSpaceId, userId: user.id, role: validRole as 'client' | 'team_member' | 'admin' },
    })
  }
}
