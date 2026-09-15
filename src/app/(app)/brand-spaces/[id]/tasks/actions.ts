'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createTask(brandSpaceId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  if (!title) return

  const description = String(formData.get('description') || '').trim() || null
  const fileUrl = String(formData.get('fileUrl') || '').trim() || null
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
