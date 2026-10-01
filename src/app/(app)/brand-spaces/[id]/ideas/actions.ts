'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'

async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to change ideas here.')
}

async function ideaForEdit(ideaId: string) {
  const idea = await db.idea.findUnique({ where: { id: ideaId } })
  if (!idea) throw new Error('Idea not found.')
  await requireEdit(idea.brandSpaceId)
  return idea
}

function refresh(brandSpaceId: string) {
  revalidatePath('/ideas')
  revalidatePath('/dashboard')
  revalidatePath('/campaigns')
  revalidatePath('/projects')
  revalidatePath(`/brand-spaces/${brandSpaceId}/ideas`)
}

export async function createIdea(formData: FormData) {
  const title = String(formData.get('title') || '').trim().slice(0, 200)
  const brandSpaceId = String(formData.get('brandSpaceId') || '')
  if (!title || !brandSpaceId) return
  await requireEdit(brandSpaceId)
  const notes = String(formData.get('notes') || '').trim().slice(0, 2000)
  await db.idea.create({ data: { brandSpaceId, title, notes: notes || null } })
  refresh(brandSpaceId)
}

// Turns the idea into a real campaign or project and keeps a record that it was promoted.
export async function promoteIdea(ideaId: string, to: 'campaign' | 'project') {
  const idea = await ideaForEdit(ideaId)
  if (idea.status !== 'open') return
  let target: string
  if (to === 'campaign') {
    const c = await db.campaign.create({ data: { brandSpaceId: idea.brandSpaceId, name: idea.title, goal: idea.notes } })
    target = `/brand-spaces/${idea.brandSpaceId}/campaigns/${c.id}`
  } else {
    const p = await db.project.create({ data: { brandSpaceId: idea.brandSpaceId, name: idea.title, description: idea.notes } })
    target = `/brand-spaces/${idea.brandSpaceId}/projects/${p.id}`
  }
  await db.idea.update({ where: { id: ideaId }, data: { status: 'promoted' } })
  refresh(idea.brandSpaceId)
  redirect(target)
}

export async function archiveIdea(ideaId: string) {
  const idea = await ideaForEdit(ideaId)
  await db.idea.update({ where: { id: ideaId }, data: { status: 'archived' } })
  refresh(idea.brandSpaceId)
}

export async function deleteIdea(ideaId: string) {
  const idea = await ideaForEdit(ideaId)
  await db.idea.delete({ where: { id: ideaId } })
  refresh(idea.brandSpaceId)
}
