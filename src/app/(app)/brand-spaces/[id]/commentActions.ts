'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function addComment(brandSpaceId: string, objectType: string, objectId: string, body: string) {
  const { user } = await getOrCreateCurrentUser()
  if (!body.trim()) return

  await db.comment.create({
    data: { brandSpaceId, objectType, objectId, authorUserId: user.id, body: body.trim() },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}`)
}
