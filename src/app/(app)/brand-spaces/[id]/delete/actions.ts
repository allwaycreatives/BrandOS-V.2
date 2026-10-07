'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

// Permanently deletes a brand and everything inside it. Owner only, and the owner must type the
// brand's exact name. The database has no automatic clean-up for most of these tables, so each one
// is removed here, children before parents, inside ONE transaction: either all of it goes or none.
export async function deleteBrandSpace(brandSpaceId: string, typedName: string): Promise<{ ok: boolean; error?: string }> {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') return { ok: false, error: 'Only the workspace owner can delete a brand.' }
  const brand = access.brandSpace

  if (typedName.trim() !== brand.name) return { ok: false, error: 'The name you typed does not match. Nothing was deleted.' }

  try {
    await db.$transaction(
      async (tx) => {
        const bs = { brandSpaceId }

        // Reviews: feedback first, then the items being reviewed.
        await tx.deliverableFeedback.deleteMany({ where: { deliverable: bs } })
        await tx.deliverable.deleteMany({ where: bs })

        // Loose rows that point at the brand by id only (no database link to clean them up).
        await tx.comment.deleteMany({ where: bs })
        await tx.notification.deleteMany({ where: bs })

        // Boards: cards first.
        await tx.boardCard.deleteMany({ where: { board: bs } })
        await tx.board.deleteMany({ where: bs })

        // Planning: things that sit inside campaigns and projects go before the campaigns and projects.
        await tx.calendarItem.deleteMany({ where: bs })
        await tx.task.deleteMany({ where: bs })
        await tx.campaign.deleteMany({ where: bs })
        await tx.project.deleteMany({ where: bs })
        await tx.idea.deleteMany({ where: bs })

        // Discovery: edits, then answers, then versions, then the question sets.
        await tx.discoveryResponseEdit.deleteMany({ where: { response: bs } })
        await tx.discoveryResponse.deleteMany({ where: bs })
        await tx.discoveryTemplateVersion.deleteMany({ where: { template: bs } })
        await tx.discoveryTemplate.deleteMany({ where: bs })

        // Brand identity.
        await tx.brandKitItem.deleteMany({ where: bs })
        await tx.brandProfile.deleteMany({ where: bs })

        // People and links into the brand.
        await tx.brandSpaceAccess.deleteMany({ where: bs })
        await tx.brandSpaceInvite.deleteMany({ where: bs })

        // Faces of this brand go. Faces on OTHER brands that pointed at this one just lose the link.
        await tx.brandFace.deleteMany({ where: bs })
        await tx.brandFace.updateMany({ where: { personalBrandId: brandSpaceId }, data: { personalBrandId: null } })

        // Personal brands under this one stay, unlinked.
        await tx.brandSpace.updateMany({ where: { parentId: brandSpaceId }, data: { parentId: null } })

        await tx.brandSpace.delete({ where: { id: brandSpaceId } })
      },
      { timeout: 30000, maxWait: 10000 }
    )
  } catch (e) {
    console.error('deleteBrandSpace failed', e)
    return { ok: false, error: 'Could not delete this brand, so nothing was changed. Please try again.' }
  }

  revalidatePath('/dashboard')
  revalidatePath('/', 'layout')
  return { ok: true }
}
