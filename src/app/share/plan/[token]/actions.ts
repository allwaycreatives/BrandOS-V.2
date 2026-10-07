'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { notifyBrandTeam } from '@/lib/notify'
import { visibleToClient } from '@/lib/plan'

// Used by clients on the public plan. No account: the secret link is the key.
export async function submitPlanFeedback(token: string, itemId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: 'This link is not valid.' }
  const brand = await db.brandSpace.findUnique({ where: { planToken: token }, select: { id: true } })
  if (!brand) return { ok: false, error: 'This plan link is no longer active.' }
  const item = await db.calendarItem.findUnique({ where: { id: itemId } })
  if (!item || item.brandSpaceId !== brand.id || !visibleToClient(item.status)) return { ok: false, error: 'This post is not available.' }

  const kind = String(formData.get('kind') || '')
  if (!['comment', 'changes_requested', 'approved'].includes(kind)) return { ok: false, error: 'Something went wrong.' }
  const name = String(formData.get('name') || '').trim().slice(0, 60)
  const body = String(formData.get('body') || '').trim().slice(0, 2000)
  const at = String(formData.get('at') || '').trim().slice(0, 20)
  if (!name) return { ok: false, error: 'Please add your name so the team knows who this is from.' }
  if (kind !== 'approved' && !body) return { ok: false, error: 'Please write your comment first.' }

  // Basic spam limit: at most 30 entries per post per hour.
  const recent = await db.calendarItemFeedback.count({ where: { itemId, fromClient: true, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } } })
  if (recent >= 30) return { ok: false, error: 'Too many messages just now. Please try again later.' }

  await db.calendarItemFeedback.create({ data: { itemId, authorName: name, fromClient: true, kind, body, at: at || null } })
  if (kind === 'approved' || kind === 'changes_requested') {
    await db.calendarItem.update({ where: { id: itemId }, data: { clientStatus: kind } })
  }

  revalidatePath(`/brand-spaces/${brand.id}/calendar`)
  revalidatePath(`/brand-spaces/${brand.id}/calendar/${itemId}`)
  revalidatePath('/dashboard')

  const what = kind === 'approved' ? 'approved' : kind === 'changes_requested' ? 'requested changes on' : 'commented on'
  await notifyBrandTeam({
    brandSpaceId: brand.id,
    title: `${name} ${what} "${item.title}"`,
    body: body ? (body.length > 140 ? `${body.slice(0, 140)}…` : body) : undefined,
    href: `/brand-spaces/${brand.id}/calendar/${itemId}`,
  }).catch(() => {})

  return { ok: true }
}
