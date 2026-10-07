'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'
import { safeUrl } from '@/lib/embed'
import { parseDay } from '@/lib/plan'

const STATUSES = ['idea', 'planned', 'in_production', 'scheduled', 'published'] as const
type Status = (typeof STATUSES)[number]

// Only the workspace owner and team members can change the calendar. Clients never can.
async function requireTeam(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have access to change this calendar.')
  return access
}

async function itemOf(brandSpaceId: string, itemId: string) {
  await requireTeam(brandSpaceId)
  const item = await db.calendarItem.findUnique({ where: { id: itemId } })
  if (!item || item.brandSpaceId !== brandSpaceId) throw new Error('That post was not found.')
  return item
}

function refresh(brandSpaceId: string, itemId?: string) {
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
  if (itemId) revalidatePath(`/brand-spaces/${brandSpaceId}/calendar/${itemId}`)
}

export async function createCalendarItem(brandSpaceId: string, formData: FormData) {
  await requireTeam(brandSpaceId)
  const title = String(formData.get('title') || '').trim().slice(0, 200)
  const platform = String(formData.get('platform') || '').trim().slice(0, 40)
  const date = String(formData.get('date') || '').trim()
  const status = STATUSES.includes(String(formData.get('status')) as Status) ? (String(formData.get('status')) as Status) : 'idea'
  if (!title) return

  await db.calendarItem.create({
    data: { brandSpaceId, title, platform: platform || 'Instagram', status, scheduledDate: date ? parseDay(date) : null },
  })
  refresh(brandSpaceId)
}

export async function moveCalendarItem(brandSpaceId: string, itemId: string, direction: -1 | 1) {
  const item = await itemOf(brandSpaceId, itemId)
  const nextIndex = STATUSES.indexOf(item.status as Status) + direction
  if (nextIndex < 0 || nextIndex >= STATUSES.length) return
  await db.calendarItem.update({ where: { id: itemId }, data: { status: STATUSES[nextIndex] } })
  refresh(brandSpaceId)
}

// Used by drag and drop on the plan. null puts the post back in "not scheduled yet".
export async function scheduleCalendarItem(brandSpaceId: string, itemId: string, day: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    await itemOf(brandSpaceId, itemId)
    const date = day ? parseDay(day) : null
    if (day && !date) return { ok: false, error: 'That date is not valid.' }
    await db.calendarItem.update({ where: { id: itemId }, data: { scheduledDate: date } })
    refresh(brandSpaceId, itemId)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not move this post. Please try again.' }
  }
}

export type ItemDetails = {
  platform: string
  hook: string
  keyMessage: string
  script: string
  caption: string
  assetUrl: string
  thumbnailUrl: string
  scheduledDate: string // YYYY-MM-DD or ''
  status: string
}

export async function updateCalendarItemDetails(brandSpaceId: string, itemId: string, data: ItemDetails): Promise<{ ok: boolean; error?: string }> {
  let item
  try {
    item = await itemOf(brandSpaceId, itemId)
  } catch {
    return { ok: false, error: 'You do not have access to change this post.' }
  }

  const platform = data.platform.trim().slice(0, 40)
  if (!platform) return { ok: false, error: 'Please choose a platform.' }
  if (!STATUSES.includes(data.status as Status)) return { ok: false, error: 'That status is not valid.' }

  const asset = data.assetUrl.trim() ? safeUrl(data.assetUrl) : null
  if (data.assetUrl.trim() && !asset) return { ok: false, error: 'The video link does not look right. Paste the full link.' }
  const thumb = data.thumbnailUrl.trim() ? safeUrl(data.thumbnailUrl) : null
  if (data.thumbnailUrl.trim() && !thumb) return { ok: false, error: 'The thumbnail link does not look right.' }
  const date = data.scheduledDate.trim() ? parseDay(data.scheduledDate.trim()) : null
  if (data.scheduledDate.trim() && !date) return { ok: false, error: 'That date is not valid.' }

  const caption = data.caption.trim() || null
  // If the client already approved this post and the thing they approved changes, it needs approving again.
  const changedForClient = asset !== item.assetUrl || thumb !== item.thumbnailUrl || caption !== item.caption
  const reopen = item.clientStatus === 'approved' && changedForClient

  await db.calendarItem.update({
    where: { id: itemId },
    data: {
      platform,
      hook: data.hook.trim() || null,
      keyMessage: data.keyMessage.trim() || null,
      script: data.script.trim() || null,
      caption,
      assetUrl: asset,
      thumbnailUrl: thumb,
      scheduledDate: date,
      status: data.status,
      ...(reopen ? { clientStatus: 'pending' } : {}),
    },
  })
  refresh(brandSpaceId, itemId)
  return { ok: true }
}

export async function deleteCalendarItem(brandSpaceId: string, itemId: string): Promise<{ ok: boolean }> {
  try {
    await itemOf(brandSpaceId, itemId)
    await db.$transaction([db.calendarItemFeedback.deleteMany({ where: { itemId } }), db.calendarItem.delete({ where: { id: itemId } })])
    refresh(brandSpaceId)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

// Team reply in the post's conversation with the client.
export async function addPostReply(brandSpaceId: string, itemId: string, formData: FormData) {
  await itemOf(brandSpaceId, itemId)
  const body = String(formData.get('body') || '').trim().slice(0, 2000)
  if (!body) return
  const { user } = await getOrCreateCurrentUser()
  await db.calendarItemFeedback.create({ data: { itemId, authorName: user.name || 'Team', fromClient: false, kind: 'comment', body } })
  refresh(brandSpaceId, itemId)
}

// "I have fixed it": marks the client's change requests as addressed and asks for approval again.
export async function sendBackForApproval(brandSpaceId: string, itemId: string) {
  await itemOf(brandSpaceId, itemId)
  await db.$transaction([
    db.calendarItemFeedback.updateMany({ where: { itemId, fromClient: true, kind: 'changes_requested', resolved: false }, data: { resolved: true } }),
    db.calendarItem.update({ where: { id: itemId }, data: { clientStatus: 'pending' } }),
  ])
  refresh(brandSpaceId, itemId)
}

// ---- Sharing the plan with the client ----

export async function enablePlanShare(brandSpaceId: string) {
  const { brandSpace } = await requireTeam(brandSpaceId)
  if (brandSpace.planToken) return { token: brandSpace.planToken }
  const token = randomBytes(18).toString('base64url')
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { planToken: token } })
  refresh(brandSpaceId)
  return { token }
}

export async function disablePlanShare(brandSpaceId: string) {
  await requireTeam(brandSpaceId)
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { planToken: null } })
  refresh(brandSpaceId)
}

export async function savePlanNote(brandSpaceId: string, note: string): Promise<{ ok: boolean }> {
  await requireTeam(brandSpaceId)
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { planNote: note.trim().slice(0, 1500) || null } })
  refresh(brandSpaceId)
  return { ok: true }
}
