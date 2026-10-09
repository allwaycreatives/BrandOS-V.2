'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'
import { safeUrl } from '@/lib/embed'
import { parseDay } from '@/lib/plan'
import { CONTENT_TYPES, PRIORITIES } from '@/lib/contentOptions'
import { cleanRule, planShoots, type ShootRule } from '@/lib/production'

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

  const day = date ? parseDay(date) : null
  const onProduction = String(formData.get('dateField') || '') === 'production'
  await db.calendarItem.create({
    data: { brandSpaceId, title, platform: platform || 'Instagram', status, ...(onProduction ? { productionDate: day } : { scheduledDate: day }) },
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
export async function scheduleCalendarItem(brandSpaceId: string, itemId: string, day: string | null, field: 'publish' | 'production' = 'publish'): Promise<{ ok: boolean; error?: string }> {
  try {
    await itemOf(brandSpaceId, itemId)
    const date = day ? parseDay(day) : null
    if (day && !date) return { ok: false, error: 'That date is not valid.' }
    await db.calendarItem.update({ where: { id: itemId }, data: field === 'production' ? { productionDate: date } : { scheduledDate: date } })
    refresh(brandSpaceId, itemId)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not move this post. Please try again.' }
  }
}

export type ItemDetails = {
  title: string
  platform: string
  hook: string
  keyMessage: string
  script: string
  caption: string
  assetUrl: string
  thumbnailUrl: string
  scheduledDate: string // publish date, YYYY-MM-DD or ''
  publishTime: string // HH:MM or ''
  productionDate: string // YYYY-MM-DD or ''
  status: string
  contentType: string
  priority: string
  pillar: string
  series: string
  hookOptions: string[]
  objective: string
  cta: string
  productionNotes: string
  successMetric: string
  notes: string
}

export async function updateCalendarItemDetails(brandSpaceId: string, itemId: string, data: ItemDetails): Promise<{ ok: boolean; error?: string }> {
  let item
  try {
    item = await itemOf(brandSpaceId, itemId)
  } catch {
    return { ok: false, error: 'You do not have access to change this post.' }
  }

  const title = data.title.trim().slice(0, 200)
  if (!title) return { ok: false, error: 'The post needs a title.' }
  const platform = data.platform.trim().slice(0, 40)
  if (!platform) return { ok: false, error: 'Please choose a platform.' }
  if (!STATUSES.includes(data.status as Status)) return { ok: false, error: 'That status is not valid.' }

  const asset = data.assetUrl.trim() ? safeUrl(data.assetUrl) : null
  if (data.assetUrl.trim() && !asset) return { ok: false, error: 'The video link does not look right. Paste the full link.' }
  const thumb = data.thumbnailUrl.trim() ? safeUrl(data.thumbnailUrl) : null
  if (data.thumbnailUrl.trim() && !thumb) return { ok: false, error: 'The thumbnail link does not look right.' }
  const date = data.scheduledDate.trim() ? parseDay(data.scheduledDate.trim()) : null
  if (data.scheduledDate.trim() && !date) return { ok: false, error: 'The publish date is not valid.' }
  const time = data.publishTime.trim()
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: 'The publish time is not valid.' }
  const prodDate = data.productionDate.trim() ? parseDay(data.productionDate.trim()) : null
  if (data.productionDate.trim() && !prodDate) return { ok: false, error: 'The production date is not valid.' }
  if (data.contentType && !CONTENT_TYPES.some((t) => t.key === data.contentType)) return { ok: false, error: 'That format is not valid.' }
  if (!PRIORITIES.some((p) => p.key === data.priority)) return { ok: false, error: 'That priority is not valid.' }
  const hookOptions = (Array.isArray(data.hookOptions) ? data.hookOptions : []).map((h) => String(h).trim().slice(0, 300)).filter(Boolean).slice(0, 12)
  const opt = (v: string, n: number) => (v ? String(v).trim().slice(0, n) || null : null)

  const caption = data.caption.trim() || null
  // If the client already approved this post and the thing they approved changes, it needs approving again.
  const changedForClient = asset !== item.assetUrl || thumb !== item.thumbnailUrl || caption !== item.caption
  const reopen = item.clientStatus === 'approved' && changedForClient

  await db.calendarItem.update({
    where: { id: itemId },
    data: {
      title,
      platform,
      hook: data.hook.trim() || null,
      keyMessage: data.keyMessage.trim() || null,
      script: data.script.trim() || null,
      caption,
      assetUrl: asset,
      thumbnailUrl: thumb,
      scheduledDate: date,
      publishTime: time || null,
      productionDate: prodDate,
      status: data.status,
      contentType: data.contentType || null,
      priority: data.priority,
      pillar: opt(data.pillar, 80),
      series: opt(data.series, 80),
      hookOptions,
      objective: opt(data.objective, 1000),
      cta: opt(data.cta, 500),
      productionNotes: opt(data.productionNotes, 3000),
      successMetric: opt(data.successMetric, 500),
      notes: opt(data.notes, 3000),
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

// Plans the shoot days for one month of posts. With apply=false it only reports what WOULD happen.
export async function planProduction(
  brandSpaceId: string,
  month: string,
  rule: ShootRule,
  overwrite: boolean,
  apply: boolean
): Promise<{ ok: boolean; error?: string; perDay?: { day: string; count: number }[]; unmatched?: number; kept?: number; applied?: number }> {
  try {
    await requireTeam(brandSpaceId)
  } catch {
    return { ok: false, error: 'You do not have access to change this calendar.' }
  }
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: 'That month is not valid.' }
  const clean = cleanRule(rule)
  if (!clean) return { ok: false, error: 'Please fill in the shoot days for this option.' }

  const from = parseDay(`${month}-01`)
  if (!from) return { ok: false, error: 'That month is not valid.' }
  const to = new Date(from)
  to.setUTCMonth(to.getUTCMonth() + 1)

  const posts = await db.calendarItem.findMany({
    where: { brandSpaceId, status: { not: 'published' }, scheduledDate: { gte: from, lt: to } },
    select: { id: true, scheduledDate: true, productionDate: true },
  })
  const plan = planShoots(
    clean,
    posts.map((p) => ({ id: p.id, publish: (p.scheduledDate as Date).toISOString().slice(0, 10), production: p.productionDate ? p.productionDate.toISOString().slice(0, 10) : null })),
    overwrite
  )
  if (!apply) return { ok: true, perDay: plan.perDay, unmatched: plan.unmatched, kept: plan.kept }

  const byDay = new Map<string, string[]>()
  for (const a of plan.assignments) byDay.set(a.day, [...(byDay.get(a.day) ?? []), a.id])
  await db.$transaction(Array.from(byDay, ([day, ids]) => db.calendarItem.updateMany({ where: { id: { in: ids }, brandSpaceId }, data: { productionDate: parseDay(day) } })))
  refresh(brandSpaceId)
  return { ok: true, perDay: plan.perDay, unmatched: plan.unmatched, kept: plan.kept, applied: plan.assignments.length }
}

// One idea, one version per platform. Copies the idea (title, pillar, series, objective, message, hook) but NOT the
// caption, script, video or dates, because each platform's version should be developed for that platform.
export async function makeVersion(brandSpaceId: string, itemId: string, platform: string): Promise<{ ok: boolean; error?: string; itemId?: string }> {
  try {
    const item = await itemOf(brandSpaceId, itemId)
    const target = platform.trim().slice(0, 40)
    if (!target) return { ok: false, error: 'Please choose a platform.' }
    const copy = await db.calendarItem.create({
      data: {
        brandSpaceId,
        title: item.title,
        platform: target,
        status: 'idea',
        pillar: item.pillar,
        series: item.series,
        objective: item.objective,
        keyMessage: item.keyMessage,
        hook: item.hook,
        hookOptions: item.hookOptions,
        priority: item.priority,
        campaignId: item.campaignId,
        projectId: item.projectId,
        notes: `Version of "${item.title}" (${item.platform}). Develop it for ${target}.`,
      },
    })
    refresh(brandSpaceId, copy.id)
    return { ok: true, itemId: copy.id }
  } catch {
    return { ok: false, error: 'Could not make the version. Please try again.' }
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
