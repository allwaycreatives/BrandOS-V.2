'use server'

import { db } from '@/lib/db'
import { getOrCreateCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function createTask(brandSpaceId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  if (!title) return

  const description = String(formData.get('description') || '').trim() || null
  const fileUrl = String(formData.get('fileUrl') || '').trim() || String(formData.get('fileLinkFallback') || '').trim() || null
  const assigneeUserId = String(formData.get('assigneeUserId') || '').trim() || null

  await db.task.create({
    data: { brandSpaceId, title, description, fileUrl, assigneeUserId, status: 'open' },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

export async function updateTaskStatus(brandSpaceId: string, taskId: string, status: string) {
  await db.task.update({ where: { id: taskId }, data: { status } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}

export async function addTaskComment(brandSpaceId: string, taskId: string, body: string) {
  const { user } = await getOrCreateCurrentUser()
  if (!body.trim()) return

  await db.comment.create({
    data: { brandSpaceId, objectType: 'task', objectId: taskId, authorUserId: user.id, body: body.trim() },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/tasks`)
}
