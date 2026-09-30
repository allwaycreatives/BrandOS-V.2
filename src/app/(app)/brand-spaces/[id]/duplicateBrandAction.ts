'use server'

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { assertBrandSpaceAccess } from '@/lib/auth'

// Copies the setup of a brand so a new client or project starts from something that works:
// boards and their cards, discovery questions, campaigns (as a fresh plan), platform order.
// It does NOT copy people, invites, the brand profile and kit, answers, comments or files.
export async function duplicateBrandSpace(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role !== 'agency') throw new Error('Only the workspace owner can duplicate a brand.')
  const source = access.brandSpace

  const copy = await db.brandSpace.create({
    data: {
      name: `${source.name} (copy)`,
      organizationId: source.organizationId,
      ...(source.platformPriority ? { platformPriority: source.platformPriority as Prisma.InputJsonValue } : {}),
    },
  })

  const boards = await db.board.findMany({ where: { brandSpaceId }, include: { cards: true }, orderBy: { createdAt: 'asc' } })
  for (const b of boards) {
    await db.board.create({
      data: {
        brandSpaceId: copy.id,
        name: b.name,
        cards: { create: b.cards.map((c) => ({ type: c.type, content: c.content, positionX: c.positionX, positionY: c.positionY })) },
      },
    })
  }

  const templates = await db.discoveryTemplate.findMany({ where: { brandSpaceId }, include: { versions: true } })
  for (const t of templates) {
    await db.discoveryTemplate.create({
      data: {
        brandSpaceId: copy.id,
        name: t.name,
        isDefault: t.isDefault,
        isActive: t.isActive,
        format: t.format,
        versions: {
          create: t.versions.map((v) => ({ questionsJson: v.questionsJson as Prisma.InputJsonValue, versionNumber: v.versionNumber })),
        },
      },
    })
  }

  const campaigns = await db.campaign.findMany({ where: { brandSpaceId }, include: { calendarItems: true, tasks: true } })
  for (const c of campaigns) {
    await db.campaign.create({
      data: {
        brandSpaceId: copy.id,
        name: c.name,
        goal: c.goal,
        calendarItems: {
          create: c.calendarItems.map((i) => ({
            brandSpaceId: copy.id,
            title: i.title,
            platform: i.platform,
            hook: i.hook,
            keyMessage: i.keyMessage,
            script: i.script,
            caption: i.caption,
            status: 'idea',
          })),
        },
        tasks: { create: c.tasks.map((t) => ({ brandSpaceId: copy.id, title: t.title, description: t.description, status: 'open' })) },
      },
    })
  }

  revalidatePath('/dashboard')
  return { brandSpaceId: copy.id }
}
