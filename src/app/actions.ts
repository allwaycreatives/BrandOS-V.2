'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser, assertBrandSpaceAccess } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createBrandSpace(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  if (!name) return

  const { organizationId } = await getOrCreateCurrentUser()

  await db.brandSpace.create({
    data: {
      name,
      organizationId,
    },
  })

  revalidatePath('/dashboard')
}

// Quick create from Home: add a task to any brand you can work in.
export async function quickCreateTask(formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  const brandSpaceId = String(formData.get('brandSpaceId') || '')
  if (!title || !brandSpaceId) return

  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') return

  await db.task.create({ data: { brandSpaceId, title, status: 'open' } })

  revalidatePath('/dashboard')
  revalidatePath('/tasks')
  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

// First-run guide. These deliberately do not revalidate /dashboard: that would swap the
// guide for the normal Home halfway through. The guide refreshes once at the end.
export async function createBrandForOnboarding(name: string) {
  const clean = name.trim().slice(0, 80)
  if (!clean) throw new Error('Please enter a name.')
  const { organizationId } = await getOrCreateCurrentUser()
  const brand = await db.brandSpace.create({ data: { name: clean, organizationId } })
  return { brandSpaceId: brand.id }
}

export async function addTaskToBrand(brandSpaceId: string, title: string) {
  const clean = title.trim().slice(0, 200)
  if (!clean) return { ok: false }
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('No access.')
  await db.task.create({ data: { brandSpaceId, title: clean, status: 'open' } })
  return { ok: true }
}
