'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { createBoardsFromTemplate } from '../../brand-spaces/[id]/boards/actions'

// Sets up a brand built around founders: one shared brand, plus a personal brand for each founder
// linked to it. Each starts with the right boards, and the shared brand gets a first decision to make.
export async function createFounderBrands(sharedName: string, founderNames: string[]): Promise<{ brandSpaceId?: string; error?: string }> {
  const shared = sharedName.trim().slice(0, 80)
  const founders = Array.from(new Set(founderNames.map((n) => n.trim().slice(0, 80)).filter(Boolean))).slice(0, 5)
  if (!shared) return { error: 'Please name the shared brand.' }
  if (founders.length === 0) return { error: 'Add at least one founder.' }

  const { organizationId } = await getOrCreateCurrentUser()
  const parent = await db.brandSpace.create({ data: { name: shared, organizationId } })

  const kids: string[] = []
  for (const name of founders) {
    const kid = await db.brandSpace.create({ data: { name, organizationId, parentId: parent.id } })
    kids.push(kid.id)
  }

  // Shared brand: the architecture decision first, then the full brand bible.
  await createBoardsFromTemplate(parent.id, 'brand-bible')
  await createBoardsFromTemplate(parent.id, 'brand-architecture')
  for (const id of kids) await createBoardsFromTemplate(id, 'founder-profile')

  await db.task.create({
    data: { brandSpaceId: parent.id, title: 'Decide which platforms are shared and which are personal', status: 'open' },
  })

  revalidatePath('/dashboard')
  return { brandSpaceId: parent.id }
}
