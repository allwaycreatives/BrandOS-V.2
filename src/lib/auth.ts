import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from './db'

export async function getOrCreateCurrentUser() {
  const { userId } = auth()
  if (!userId) throw new Error('Not authenticated')

  let user = await db.user.findUnique({ where: { authProviderId: userId } })

  if (!user) {
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@placeholder.local`
    const name = clerkUser?.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : undefined

    user = await db.user.create({ data: { authProviderId: userId, email, name } })

    // Every new person gets their own workspace on first login.
    const organization = await db.organization.create({
      data: { name: name ? `${name}'s workspace` : 'My workspace', type: 'solo' },
    })
    await db.membership.create({ data: { userId: user.id, organizationId: organization.id, role: 'owner' } })
  }

  const membership = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })
  if (!membership) throw new Error('No organization found for this user')

  return { user, organizationId: membership.organizationId }
}

// Returns the brand space if the current user owns it (same organization)
// OR has been explicitly invited to it (a BrandSpaceAccess row) — otherwise null.
export async function assertBrandSpaceAccess(brandSpaceId: string) {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const brandSpace = await db.brandSpace.findUnique({ where: { id: brandSpaceId } })
  if (!brandSpace) return null

  if (brandSpace.organizationId === organizationId) return brandSpace

  const access = await db.brandSpaceAccess
    .findUnique({ where: { brandSpaceId_userId: { brandSpaceId, userId: user.id } } })
    .catch(() => null)

  return access ? brandSpace : null
}
