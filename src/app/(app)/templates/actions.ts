'use server'

import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess, getOrCreateCurrentUser } from '@/lib/auth'
import { getUserBrands } from '@/lib/brands'

type CardSnap = { type: string; content: string; x: number; y: number }
type ContentSnap = { title: string; platform: string; hook: string | null; keyMessage: string | null; script: string | null; caption: string | null }
type TaskSnap = { title: string; description: string | null }
type BoardSnap = { name: string; cards: CardSnap[] }

export type TemplatePayload = {
  goal?: string | null
  description?: string | null
  cards?: CardSnap[]
  content?: ContentSnap[]
  tasks?: TaskSnap[]
  boards?: BoardSnap[]
}

const cardsOf = (cards: { type: string; content: string; positionX: number; positionY: number }[]): CardSnap[] =>
  cards.map((c) => ({ type: c.type, content: c.content, x: c.positionX, y: c.positionY }))

async function requireEdit(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') throw new Error('You do not have permission to do this here.')
}

// Takes a snapshot of a board, campaign or project and keeps it in the workspace's templates.
export async function saveAsTemplate(kind: 'board' | 'campaign' | 'project', sourceId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const clean = name.trim().slice(0, 80)
  if (!clean) return { ok: false, error: 'Please give the template a name.' }
  const { organizationId } = await getOrCreateCurrentUser()

  let payload: TemplatePayload
  if (kind === 'board') {
    const b = await db.board.findUnique({ where: { id: sourceId }, include: { cards: true } })
    if (!b) return { ok: false, error: 'Board not found.' }
    await requireEdit(b.brandSpaceId)
    payload = { cards: cardsOf(b.cards) }
  } else if (kind === 'campaign') {
    const c = await db.campaign.findUnique({ where: { id: sourceId }, include: { calendarItems: true, tasks: true } })
    if (!c) return { ok: false, error: 'Campaign not found.' }
    await requireEdit(c.brandSpaceId)
    payload = {
      goal: c.goal,
      content: c.calendarItems.map((i) => ({ title: i.title, platform: i.platform, hook: i.hook, keyMessage: i.keyMessage, script: i.script, caption: i.caption })),
      tasks: c.tasks.map((t) => ({ title: t.title, description: t.description })),
    }
  } else if (kind === 'project') {
    const p = await db.project.findUnique({ where: { id: sourceId }, include: { tasks: true, boards: { include: { cards: true } } } })
    if (!p) return { ok: false, error: 'Project not found.' }
    await requireEdit(p.brandSpaceId)
    payload = {
      description: p.description,
      tasks: p.tasks.map((t) => ({ title: t.title, description: t.description })),
      boards: p.boards.map((b) => ({ name: b.name, cards: cardsOf(b.cards) })),
    }
  } else {
    return { ok: false, error: 'Unknown kind.' }
  }

  await db.template.create({ data: { organizationId, kind, name: clean, payloadJson: payload as unknown as Prisma.InputJsonValue } })
  revalidatePath('/templates')
  return { ok: true }
}

// Creates a fresh board, campaign or project from a template, in the chosen brand. Returns where to go next.
export async function createFromTemplate(templateId: string, brandSpaceId: string): Promise<{ href?: string; error?: string }> {
  const { user, organizationId } = await getOrCreateCurrentUser()
  const t = await db.template.findUnique({ where: { id: templateId } })
  if (!t || t.organizationId !== organizationId) return { error: 'Template not found.' }

  const brands = (await getUserBrands(user.id, organizationId)).filter((b) => b.role !== 'client')
  if (!brands.some((b) => b.id === brandSpaceId)) return { error: 'Pick a brand you can work in.' }
  await requireEdit(brandSpaceId)

  const p = t.payloadJson as unknown as TemplatePayload
  const cardCreate = (cards: CardSnap[]) => ({ create: cards.map((c) => ({ type: c.type, content: c.content, positionX: c.x, positionY: c.y })) })
  const taskCreate = (tasks: TaskSnap[]) => ({ create: tasks.map((x) => ({ brandSpaceId, title: x.title, description: x.description, status: 'open' })) })

  revalidatePath('/dashboard')
  if (t.kind === 'board') {
    const b = await db.board.create({ data: { brandSpaceId, name: t.name, cards: cardCreate(p.cards ?? []) } })
    return { href: `/brand-spaces/${brandSpaceId}/boards/${b.id}` }
  }
  if (t.kind === 'campaign') {
    const c = await db.campaign.create({
      data: {
        brandSpaceId,
        name: t.name,
        goal: p.goal ?? null,
        calendarItems: {
          create: (p.content ?? []).map((i) => ({ brandSpaceId, title: i.title, platform: i.platform, hook: i.hook, keyMessage: i.keyMessage, script: i.script, caption: i.caption, status: 'idea' })),
        },
        tasks: taskCreate(p.tasks ?? []),
      },
    })
    return { href: `/brand-spaces/${brandSpaceId}/campaigns/${c.id}` }
  }
  const proj = await db.project.create({
    data: {
      brandSpaceId,
      name: t.name,
      description: p.description ?? null,
      tasks: taskCreate(p.tasks ?? []),
      boards: { create: (p.boards ?? []).map((b) => ({ brandSpaceId, name: b.name, cards: cardCreate(b.cards) })) },
    },
  })
  return { href: `/brand-spaces/${brandSpaceId}/projects/${proj.id}` }
}

export async function deleteTemplate(templateId: string) {
  const { organizationId } = await getOrCreateCurrentUser()
  await db.template.deleteMany({ where: { id: templateId, organizationId } })
  revalidatePath('/templates')
}
