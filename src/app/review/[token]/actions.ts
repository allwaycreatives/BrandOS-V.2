'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { notifyBrandTeam } from '@/lib/notify'

// Used by clients on the public review page. No account: the secret link is the key.
export async function submitFeedback(token: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: 'This review link is not valid.' }
  const d = await db.deliverable.findUnique({ where: { reviewToken: token } })
  if (!d) return { ok: false, error: 'This review link is no longer active.' }

  const kind = String(formData.get('kind') || '')
  if (!['comment', 'changes_requested', 'approved'].includes(kind)) return { ok: false, error: 'Something went wrong.' }
  const name = String(formData.get('name') || '').trim().slice(0, 60)
  const body = String(formData.get('body') || '').trim().slice(0, 2000)
  const at = String(formData.get('at') || '').trim().slice(0, 20)
  const rawX = formData.get('pinX')
  const rawY = formData.get('pinY')
  const px = Number(rawX)
  const py = Number(rawY)
  const hasPin = rawX !== null && rawY !== null && rawX !== '' && rawY !== '' && Number.isFinite(px) && Number.isFinite(py) && px >= 0 && px <= 100 && py >= 0 && py <= 100
  if (!name) return { ok: false, error: 'Please add your name so the team knows who this is from.' }
  if (kind !== 'approved' && !body) return { ok: false, error: 'Please write your comment first.' }

  // Basic spam limit: at most 30 entries per deliverable per hour.
  const recent = await db.deliverableFeedback.count({
    where: { deliverableId: d.id, fromClient: true, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  })
  if (recent >= 30) return { ok: false, error: 'Too many messages just now. Please try again later.' }

  await db.deliverableFeedback.create({
    data: { deliverableId: d.id, version: d.version, authorName: name, fromClient: true, kind, body, at: at || null, pinX: hasPin ? px : null, pinY: hasPin ? py : null },
  })
  if (kind === 'approved' || kind === 'changes_requested') {
    await db.deliverable.update({ where: { id: d.id }, data: { status: kind } })
  }

  revalidatePath(`/review/${token}`)
  revalidatePath(`/brand-spaces/${d.brandSpaceId}/reviews/${d.id}`)
  revalidatePath(`/brand-spaces/${d.brandSpaceId}/reviews`)
  revalidatePath('/dashboard')

  const what = kind === 'approved' ? 'approved' : kind === 'changes_requested' ? 'requested changes on' : 'commented on'
  await notifyBrandTeam({
    brandSpaceId: d.brandSpaceId,
    title: `${name} ${what} "${d.title}"`,
    body: body ? (body.length > 140 ? `${body.slice(0, 140)}…` : body) : undefined,
    href: `/brand-spaces/${d.brandSpaceId}/reviews/${d.id}`,
  }).catch(() => {})

  return { ok: true }
}
