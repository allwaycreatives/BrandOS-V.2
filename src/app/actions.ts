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
