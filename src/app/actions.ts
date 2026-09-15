'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
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
