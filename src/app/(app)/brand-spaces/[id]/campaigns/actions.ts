'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { STAGES, PLATFORMS } from './constants'

// Clients view and approve; only owners and team members change campaigns.
async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to change campaigns here.')
}

async function campaignForEdit(campaignId: string) {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campaign not found.')
  await requireEdit(campaign.brandSpaceId)
  return campaign
}

function refresh(brandSpaceId: string, campaignId?: string | null) {
  revalidatePath('/campaigns')
  revalidatePath('/dashboard')
  revalidatePath(`/brand-spaces/${brandSpaceId}/campaigns`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
  if (campaignId) revalidatePath(`/brand-spaces/${brandSpaceId}/campaigns/${campaignId}`)
}

function dateField(formData: FormData, key: string) {
  const v = String(formData.get(key) || '')
  return v ? new Date(v) : null
}

export async function createCampaign(formData: FormData) {
  const name = String(formData.get('name') || '').trim()
  const goal = String(formData.get('goal') || '').trim()
  const brandSpaceId = String(formData.get('brandSpaceId') || '')
  if (!name || !brandSpaceId) return
  await requireEdit(brandSpaceId)
  const campaign = await db.campaign.create({ data: { brandSpaceId, name, goal: goal || null } })
  refresh(brandSpaceId)
  redirect(`/brand-spaces/${brandSpaceId}/campaigns/${campaign.id}`)
}

export async function updateCampaign(campaignId: string, formData: FormData) {
  const campaign = await campaignForEdit(campaignId)
  const name = String(formData.get('name') || '').trim()
  const status = String(formData.get('status') || 'planning')
  await db.campaign.update({
    where: { id: campaignId },
    data: {
      name: name || campaign.name,
      goal: String(formData.get('goal') || '').trim() || null,
      status: ['planning', 'live', 'done'].includes(status) ? status : 'planning',
      startDate: dateField(formData, 'startDate'),
      endDate: dateField(formData, 'endDate'),
    },
  })
  refresh(campaign.brandSpaceId, campaignId)
}

// Content is a calendar item, so it also shows up on the brand's Calendar.
export async function addCampaignContent(campaignId: string, formData: FormData) {
  const campaign = await campaignForEdit(campaignId)
  const title = String(formData.get('title') || '').trim()
  if (!title) return
  const platform = String(formData.get('platform') || '')
  await db.calendarItem.create({
    data: {
      brandSpaceId: campaign.brandSpaceId,
      campaignId,
      title,
      platform: PLATFORMS.includes(platform) ? platform : PLATFORMS[0],
      status: 'idea',
    },
  })
  refresh(campaign.brandSpaceId, campaignId)
}

export async function setContentStatus(itemId: string, status: string) {
  if (!STAGES.some((s) => s.key === status)) return
  const item = await db.calendarItem.findUnique({ where: { id: itemId } })
  if (!item) return
  await requireEdit(item.brandSpaceId)
  await db.calendarItem.update({ where: { id: itemId }, data: { status } })
  refresh(item.brandSpaceId, item.campaignId)
}

export async function addCampaignTask(campaignId: string, formData: FormData) {
  const campaign = await campaignForEdit(campaignId)
  const title = String(formData.get('title') || '').trim()
  if (!title) return
  await db.task.create({
    data: { brandSpaceId: campaign.brandSpaceId, campaignId, title, status: 'open', dueDate: dateField(formData, 'dueDate') },
  })
  revalidatePath('/tasks')
  refresh(campaign.brandSpaceId, campaignId)
}

export async function setCampaignTaskStatus(taskId: string, status: 'open' | 'done') {
  if (status !== 'open' && status !== 'done') return
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task) return
  await requireEdit(task.brandSpaceId)
  await db.task.update({ where: { id: taskId }, data: { status } })
  revalidatePath('/tasks')
  refresh(task.brandSpaceId, task.campaignId)
}

// Copies the plan, not the progress: content goes back to "Idea", tasks reopen, dates are cleared.
export async function duplicateCampaign(campaignId: string) {
  const campaign = await campaignForEdit(campaignId)
  const items = await db.calendarItem.findMany({ where: { campaignId } })
  const tasks = await db.task.findMany({ where: { campaignId } })
  const copy = await db.campaign.create({
    data: {
      brandSpaceId: campaign.brandSpaceId,
      name: `${campaign.name} (copy)`,
      goal: campaign.goal,
      calendarItems: {
        create: items.map((i) => ({
          brandSpaceId: campaign.brandSpaceId,
          title: i.title,
          platform: i.platform,
          hook: i.hook,
          keyMessage: i.keyMessage,
          script: i.script,
          caption: i.caption,
          status: 'idea',
        })),
      },
      tasks: { create: tasks.map((t) => ({ brandSpaceId: campaign.brandSpaceId, title: t.title, description: t.description, status: 'open' })) },
    },
  })
  refresh(campaign.brandSpaceId)
  redirect(`/brand-spaces/${campaign.brandSpaceId}/campaigns/${copy.id}`)
}

// Content and tasks stay (they just stop belonging to the campaign).
export async function deleteCampaign(campaignId: string) {
  const campaign = await campaignForEdit(campaignId)
  await db.campaign.delete({ where: { id: campaignId } })
  refresh(campaign.brandSpaceId)
  redirect(`/brand-spaces/${campaign.brandSpaceId}/campaigns`)
}
