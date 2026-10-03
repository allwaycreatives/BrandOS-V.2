'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { notifyBrandTeam } from '@/lib/notify'

// Public: a client sends a brief through the secret link. It becomes a project in "Brief" stage,
// with the brief attached, a first task for the team, and a notification.
export async function submitBrief(token: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  if (String(formData.get('website') || '')) return { ok: true } // hidden field only bots fill in
  if (!token) return { ok: false, error: 'This link is not valid.' }
  const brand = await db.brandSpace.findUnique({ where: { intakeToken: token }, select: { id: true, name: true } })
  if (!brand) return { ok: false, error: 'This brief link is no longer active.' }

  const name = String(formData.get('name') || '').trim().slice(0, 80)
  const contact = String(formData.get('contact') || '').trim().slice(0, 120)
  const title = String(formData.get('title') || '').trim().slice(0, 160)
  const details = String(formData.get('details') || '').trim().slice(0, 4000)
  const references = String(formData.get('references') || '').trim().slice(0, 2000)
  const deadlineRaw = String(formData.get('deadline') || '')
  if (!name) return { ok: false, error: 'Please add your name.' }
  if (!title) return { ok: false, error: 'Please tell us briefly what you need.' }
  const deadline = deadlineRaw && !Number.isNaN(Date.parse(deadlineRaw)) ? new Date(deadlineRaw) : null

  const recent = await db.project.count({
    where: { brandSpaceId: brand.id, brief: { not: null }, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  })
  if (recent >= 20) return { ok: false, error: 'Too many briefs just now. Please try again later.' }

  const brief = [details, references ? `References:\n${references}` : ''].filter(Boolean).join('\n\n')
  const project = await db.project.create({
    data: {
      brandSpaceId: brand.id,
      name: title,
      description: details ? details.slice(0, 140) : null,
      status: 'brief',
      dueDate: deadline,
      brief: brief || '(no details given)',
      briefFrom: contact ? `${name} · ${contact}` : name,
    },
  })
  await db.task.create({
    data: { brandSpaceId: brand.id, projectId: project.id, title: `Review the brief and reply to ${name}`, status: 'open', dueDate: new Date() },
  })

  await notifyBrandTeam({
    brandSpaceId: brand.id,
    title: `New brief from ${name}: "${title}"`,
    body: details ? (details.length > 140 ? `${details.slice(0, 140)}…` : details) : undefined,
    href: `/brand-spaces/${brand.id}/projects/${project.id}`,
  }).catch(() => {})

  revalidatePath('/projects')
  revalidatePath('/tasks')
  revalidatePath('/dashboard')
  revalidatePath(`/brand-spaces/${brand.id}/projects`)
  return { ok: true }
}
