'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

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
  if (!name) return { ok: false, error: 'Please add your name so the team knows who this is from.' }
  if (kind !== 'approved' && !body) return { ok: false, error: 'Please write your comment first.' }

  await db.deliverableFeedback.create({
    data: { deliverableId: d.id, version: d.version, authorName: name, fromClient: true, kind, body, at: at || null },
  })
  if (kind === 'approved' || kind === 'changes_requested') {
    await db.deliverable.update({ where: { id: d.id }, data: { status: kind } })
  }

  revalidatePath(`/review/${token}`)
  revalidatePath(`/brand-spaces/${d.brandSpaceId}/reviews/${d.id}`)
  revalidatePath(`/brand-spaces/${d.brandSpaceId}/reviews`)
  revalidatePath('/dashboard')
  return { ok: true }
}
