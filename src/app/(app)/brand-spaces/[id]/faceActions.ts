'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { createBoardsFromTemplate } from './boards/actions'

const MAX_FACES = 12

type Result = { ok: boolean; error?: string; brandSpaceId?: string }

// Faces are managed by the workspace owner only, and only on a top-level brand
// (a personal brand under a company does not have faces of its own).
async function requireOwnerOfTopLevelBrand(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') return { error: 'Only the workspace owner can change this.' as const }
  if (access.brandSpace.parentId) return { error: 'Faces belong on the company brand, not on a personal brand.' as const }
  return { brandSpace: access.brandSpace }
}

function refresh(brandSpaceId: string) {
  revalidatePath('/dashboard')
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
}

export async function addFace(brandSpaceId: string, name: string, role: string): Promise<Result> {
  const cleanName = name.trim().slice(0, 80)
  const cleanRole = role.trim().slice(0, 80)
  if (!cleanName) return { ok: false, error: 'Please enter a name.' }

  const guard = await requireOwnerOfTopLevelBrand(brandSpaceId)
  if ('error' in guard) return { ok: false, error: guard.error }

  const count = await db.brandFace.count({ where: { brandSpaceId } })
  if (count >= MAX_FACES) return { ok: false, error: `You can add up to ${MAX_FACES} faces.` }

  const existing = await db.brandFace.findMany({ where: { brandSpaceId }, select: { name: true } })
  if (existing.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
    return { ok: false, error: `${cleanName} is already listed.` }
  }

  await db.brandFace.create({ data: { brandSpaceId, name: cleanName, role: cleanRole || null } })
  refresh(brandSpaceId)
  return { ok: true }
}

// Removes the person from the list. If they already have a personal brand, that brand is kept
// and stays linked under the company; it simply shows up as a linked brand instead.
export async function removeFace(brandSpaceId: string, faceId: string): Promise<Result> {
  const guard = await requireOwnerOfTopLevelBrand(brandSpaceId)
  if ('error' in guard) return { ok: false, error: guard.error }

  const face = await db.brandFace.findUnique({ where: { id: faceId } })
  if (!face || face.brandSpaceId !== brandSpaceId) return { ok: false, error: 'That person is not on this list.' }

  await db.brandFace.delete({ where: { id: faceId } })
  refresh(brandSpaceId)
  return { ok: true }
}

// Creates the face's personal brand, linked under the company, with the Founder profile board in it.
export async function startPersonalBrand(brandSpaceId: string, faceId: string): Promise<Result> {
  const guard = await requireOwnerOfTopLevelBrand(brandSpaceId)
  if ('error' in guard) return { ok: false, error: guard.error }
  const company = guard.brandSpace

  const face = await db.brandFace.findUnique({ where: { id: faceId } })
  if (!face || face.brandSpaceId !== brandSpaceId) return { ok: false, error: 'That person is not on this list.' }
  if (face.personalBrandId) return { ok: false, error: `${face.name} already has a personal brand.` }

  // A personal brand with this person's name may already sit under the company (made with the old
  // founder setup, before faces existed). Link that one instead of making a duplicate.
  const siblings = await db.brandSpace.findMany({ where: { parentId: company.id }, select: { id: true, name: true } })
  const linkedIds = new Set(
    (await db.brandFace.findMany({ where: { brandSpaceId, personalBrandId: { not: null } }, select: { personalBrandId: true } })).map((f) => f.personalBrandId)
  )
  const existing = siblings.find((b) => !linkedIds.has(b.id) && b.name.trim().toLowerCase() === face.name.toLowerCase())

  if (existing) {
    await db.brandFace.updateMany({ where: { id: faceId, personalBrandId: null }, data: { personalBrandId: existing.id } })
    refresh(brandSpaceId)
    return { ok: true, brandSpaceId: existing.id }
  }

  // The brand and the link are created together, so a failure never leaves a half-made brand behind.
  // If a double-click already linked one, the second attempt rolls back and creates nothing.
  let brand
  try {
    brand = await db.$transaction(async (tx) => {
      const created = await tx.brandSpace.create({
        data: { name: face.name, organizationId: company.organizationId, parentId: company.id },
      })
      const linked = await tx.brandFace.updateMany({ where: { id: faceId, personalBrandId: null }, data: { personalBrandId: created.id } })
      if (linked.count !== 1) throw new Error('already-linked')
      return created
    })
  } catch {
    return { ok: false, error: `${face.name} already has a personal brand, or it could not be created. Refresh and try again.` }
  }

  await createBoardsFromTemplate(brand.id, 'founder-profile')

  refresh(brandSpaceId)
  return { ok: true, brandSpaceId: brand.id }
}
