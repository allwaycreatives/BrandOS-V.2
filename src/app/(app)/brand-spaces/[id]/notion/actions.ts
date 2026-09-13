'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function setNotionEmbedUrl(brandSpaceId: string, formData: FormData) {
  const url = String(formData.get('url') || '').trim()
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { notionEmbedUrl: url || null } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/notion`)
}
