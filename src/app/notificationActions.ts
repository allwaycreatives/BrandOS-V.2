'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'

export async function markRead(id: string) {
  const { user } = await getOrCreateCurrentUser()
  await db.notification.updateMany({ where: { id, userId: user.id, readAt: null }, data: { readAt: new Date() } })
}

export async function markAllRead() {
  const { user } = await getOrCreateCurrentUser()
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
  revalidatePath('/dashboard')
}
