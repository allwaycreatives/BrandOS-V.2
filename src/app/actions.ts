'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// Every brand space needs to belong to an organization. For now, before
// real accounts/auth exist (a later step), we auto-create one shared
// "default" organization the first time it's needed, so brand spaces have
// somewhere to live. Once login is added, this will be replaced by the
// logged-in user's own organization.
async function getOrCreateDefaultOrganization() {
  const existing = await db.organization.findFirst()
  if (existing) return existing

  return db.organization.create({
    data: { name: 'My organization', type: 'solo' },
  })
}

export async function createBrandSpace(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  if (!name) return

  const organization = await getOrCreateDefaultOrganization()

  await db.brandSpace.create({
    data: {
      name,
      organizationId: organization.id,
    },
  })

  // Tells the dashboard page to re-fetch the list so the new brand space
  // shows up immediately, without needing a manual page refresh.
  revalidatePath('/dashboard')
}
