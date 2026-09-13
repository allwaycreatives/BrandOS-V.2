'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

const STATUSES = ['idea', 'planned', 'in_production', 'scheduled', 'published'] as const

export async function createCalendarItem(brandSpaceId: string, formData: FormData) {
  const title = String(formData.get('title') || '').trim()
  const platform = String(formData.get('platform') || '').trim()
  if (!title) return

  await db.calendarItem.create({
    data: {
      brandSpaceId,
      title,
      platform: platform || 'Instagram',
      status: 'idea',
    },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
}

export async function moveCalendarItem(brandSpaceId: string, itemId: string, direction: -1 | 1) {
  const item = await db.calendarItem.findUnique({ where: { id: itemId } })
  if (!item) return

  const currentIndex = STATUSES.indexOf(item.status as (typeof STATUSES)[number])
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= STATUSES.length) return

  await db.calendarItem.update({ where: { id: itemId }, data: { status: STATUSES[nextIndex] } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
}

export async function updateCalendarItemDetails(
  brandSpaceId: string,
  itemId: string,
  data: { hook?: string; keyMessage?: string; script?: string; caption?: string; platform?: string }
) {
  await db.calendarItem.update({ where: { id: itemId }, data })
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar/${itemId}`)
}
