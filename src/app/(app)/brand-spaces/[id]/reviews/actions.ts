'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'
import { safeUrl } from '@/lib/embed'
import { generateText } from '@/lib/ai'

async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to manage reviews here.')
}

async function deliverableForEdit(id: string) {
  const d = await db.deliverable.findUnique({ where: { id } })
  if (!d) throw new Error('Deliverable not found.')
  await requireEdit(d.brandSpaceId)
  return d
}

function refresh(brandSpaceId: string, deliverableId?: string) {
  revalidatePath('/dashboard')
  revalidatePath(`/brand-spaces/${brandSpaceId}/reviews`)
  if (deliverableId) revalidatePath(`/brand-spaces/${brandSpaceId}/reviews/${deliverableId}`)
}

export async function createDeliverable(formData: FormData) {
  const brandSpaceId = String(formData.get('brandSpaceId') || '')
  const title = String(formData.get('title') || '').trim().slice(0, 200)
  const url = safeUrl(String(formData.get('url') || ''))
  if (!brandSpaceId || !title || !url) return
  await requireEdit(brandSpaceId)

  let projectId: string | null = String(formData.get('projectId') || '') || null
  if (projectId) {
    const p = await db.project.findUnique({ where: { id: projectId } })
    if (!p || p.brandSpaceId !== brandSpaceId) projectId = null
  }
  const notes = String(formData.get('notes') || '').trim().slice(0, 2000)
  const d = await db.deliverable.create({ data: { brandSpaceId, projectId, title, url, notes: notes || null } })
  refresh(brandSpaceId)
  if (projectId) revalidatePath(`/brand-spaces/${brandSpaceId}/projects/${projectId}`)
  redirect(`/brand-spaces/${brandSpaceId}/reviews/${d.id}`)
}

// Creates the link you send to the client (it works without an account) and marks it as waiting on them.
export async function enableReview(deliverableId: string) {
  const d = await deliverableForEdit(deliverableId)
  const token = d.reviewToken ?? randomBytes(18).toString('base64url')
  await db.deliverable.update({
    where: { id: deliverableId },
    data: { reviewToken: token, status: d.status === 'draft' ? 'in_review' : d.status },
  })
  refresh(d.brandSpaceId, deliverableId)
  return { token }
}

export async function disableReview(deliverableId: string) {
  const d = await deliverableForEdit(deliverableId)
  await db.deliverable.update({ where: { id: deliverableId }, data: { reviewToken: null } })
  refresh(d.brandSpaceId, deliverableId)
}

// A revised cut: bumps the version, goes back to waiting on the client, leaves a note in the history.
export async function postNewVersion(deliverableId: string, formData: FormData) {
  const d = await deliverableForEdit(deliverableId)
  const raw = String(formData.get('url') || '').trim()
  const url = raw ? safeUrl(raw) : d.url
  if (!url) return
  const note = String(formData.get('note') || '').trim().slice(0, 1000)
  const { user } = await getOrCreateCurrentUser()
  const version = d.version + 1
  await db.deliverable.update({
    where: { id: deliverableId },
    data: { url, version, status: d.reviewToken ? 'in_review' : 'draft' },
  })
  await db.deliverableFeedback.create({
    data: {
      deliverableId,
      version,
      authorName: user.name || 'Team',
      fromClient: false,
      kind: 'comment',
      body: `Version ${version} uploaded${note ? `: ${note}` : ''}`,
    },
  })
  refresh(d.brandSpaceId, deliverableId)
}

export async function addTeamReply(deliverableId: string, formData: FormData) {
  const d = await deliverableForEdit(deliverableId)
  const body = String(formData.get('body') || '').trim().slice(0, 2000)
  if (!body) return
  const { user } = await getOrCreateCurrentUser()
  await db.deliverableFeedback.create({
    data: { deliverableId, version: d.version, authorName: user.name || 'Team', fromClient: false, kind: 'comment', body },
  })
  refresh(d.brandSpaceId, deliverableId)
}

export async function resolveFeedback(feedbackId: string, resolved: boolean) {
  const f = await db.deliverableFeedback.findUnique({ where: { id: feedbackId }, include: { deliverable: true } })
  if (!f) return
  await requireEdit(f.deliverable.brandSpaceId)
  await db.deliverableFeedback.update({ where: { id: feedbackId }, data: { resolved } })
  refresh(f.deliverable.brandSpaceId, f.deliverableId)
}

export async function resolveAllFeedback(deliverableId: string) {
  const d = await deliverableForEdit(deliverableId)
  await db.deliverableFeedback.updateMany({ where: { deliverableId, resolved: false, fromClient: true }, data: { resolved: true } })
  refresh(d.brandSpaceId, deliverableId)
}

export async function deleteDeliverable(deliverableId: string) {
  const d = await deliverableForEdit(deliverableId)
  await db.deliverable.delete({ where: { id: deliverableId } })
  refresh(d.brandSpaceId)
  redirect(`/brand-spaces/${d.brandSpaceId}/reviews`)
}

export async function saveStyleSummary(brandSpaceId: string, text: string) {
  await requireEdit(brandSpaceId)
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { styleSummary: text.trim().slice(0, 6000) || null, styleSummaryAt: new Date() } })
  refresh(brandSpaceId)
}

// Reads everything this client has ever said and writes a short "what they want" summary.
export async function generateStyleSummary(brandSpaceId: string): Promise<{ text?: string; error?: string }> {
  await requireEdit(brandSpaceId)

  const deliverables = await db.deliverable.findMany({
    where: { brandSpaceId },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: { feedback: { where: { fromClient: true }, orderBy: { createdAt: 'asc' } } },
  })
  const withFeedback = deliverables.filter((d) => d.feedback.length > 0)
  if (withFeedback.length === 0) return { error: 'There is no client feedback yet. Send a review link first, then come back.' }

  let material = ''
  for (const d of withFeedback) {
    material += `\nDeliverable: ${d.title} (status: ${d.status}, versions: ${d.version})\n`
    for (const f of d.feedback) {
      material += `- [${f.kind}${f.at ? ` @${f.at}` : ''}] ${f.body || '(approved with no comment)'}\n`
    }
  }
  material = material.slice(0, 12000)

  const prompt = `You help a creative agency understand a client. Below is every piece of feedback this client has given on the agency's work. Write a short, practical summary for the team, in plain text with these three headings:

What they like
What they keep changing
Style notes for the team

Use short bullet lines starting with "- ". Only state patterns the feedback actually supports. If there is too little feedback to see a pattern, say so honestly instead of guessing. Do not use markdown symbols other than the "- " bullets.

Client feedback:
${material}`

  try {
    const text = (await generateText(prompt)).trim()
    if (!text) return { error: 'The summary came back empty. Please try again.' }
    await db.brandSpace.update({ where: { id: brandSpaceId }, data: { styleSummary: text.slice(0, 6000), styleSummaryAt: new Date() } })
    refresh(brandSpaceId)
    return { text }
  } catch {
    return { error: 'Could not reach the AI service. Check the AI key in your settings and try again.' }
  }
}
