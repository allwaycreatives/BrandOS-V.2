'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { createBoardsFromTemplate } from '../../brand-spaces/[id]/boards/actions'

export type FounderSetupMode = 'company' | 'both'

// Sets up a company brand with its founders as "faces".
//  - 'company' (default): just the company brand. The founders are listed as its faces, and each one
//    can get a personal brand later, from the company page.
//  - 'both': the company brand AND a linked personal brand per founder, right now.
export async function createFounderBrands(
  sharedName: string,
  founderNames: string[],
  mode: FounderSetupMode = 'company'
): Promise<{ brandSpaceId?: string; error?: string }> {
  const shared = sharedName.trim().slice(0, 80)
  const founders = Array.from(new Set(founderNames.map((n) => n.trim().slice(0, 80)).filter(Boolean))).slice(0, 5)
  if (!shared) return { error: 'Please name the company brand.' }
  if (founders.length === 0) return { error: 'Add at least one founder.' }
  const withPersonal = mode === 'both'

  const { organizationId } = await getOrCreateCurrentUser()

  // Everything is saved together, so a failure never leaves half a setup behind.
  const { parentId, kidIds } = await db.$transaction(async (tx) => {
    const parent = await tx.brandSpace.create({ data: { name: shared, organizationId } })
    const kidIds: string[] = []
    for (const name of founders) {
      let personalBrandId: string | null = null
      if (withPersonal) {
        const kid = await tx.brandSpace.create({ data: { name, organizationId, parentId: parent.id } })
        personalBrandId = kid.id
        kidIds.push(kid.id)
      }
      await tx.brandFace.create({ data: { brandSpaceId: parent.id, name, personalBrandId } })
    }
    await tx.task.create({
      data: {
        brandSpaceId: parent.id,
        title: withPersonal
          ? 'Decide which platforms are shared and which are personal'
          : `Decide the company's main platforms and which faces show up on them`,
        status: 'open',
      },
    })
    return { parentId: parent.id, kidIds }
  })

  // Boards: the architecture decision first, then the full brand bible.
  await createBoardsFromTemplate(parentId, 'brand-bible')
  await createBoardsFromTemplate(parentId, 'brand-architecture')
  for (const id of kidIds) await createBoardsFromTemplate(id, 'founder-profile')

  revalidatePath('/dashboard')
  return { brandSpaceId: parentId }
}
