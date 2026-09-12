'use server'

import { db } from '@/lib/db'
import { discoveryQuestions } from '@/lib/discoveryQuestions'

// The first time a brand space receives a discovery submission, we create
// its DiscoveryTemplate + DiscoveryTemplateVersion from the fixed question
// set in discoveryQuestions.ts. Later, this is where template *editing*
// (Decision 1 in the PRD) will plug in — for now everyone gets the same
// well-researched default.
async function getOrCreateTemplateVersion(brandSpaceId: string) {
  const existingTemplate = await db.discoveryTemplate.findFirst({
    where: { brandSpaceId },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  })

  if (existingTemplate && existingTemplate.versions[0]) {
    return existingTemplate.versions[0]
  }

  const template = await db.discoveryTemplate.create({
    data: { brandSpaceId, name: 'Default discovery', isDefault: true },
  })

  return db.discoveryTemplateVersion.create({
    data: {
      templateId: template.id,
      versionNumber: 1,
      questionsJson: discoveryQuestions,
    },
  })
}

export async function submitDiscoveryResponse(brandSpaceId: string, answers: Record<string, string | string[]>) {
  const templateVersion = await getOrCreateTemplateVersion(brandSpaceId)

  await db.discoveryResponse.create({
    data: {
      brandSpaceId,
      templateVersionId: templateVersion.id,
      answersJson: answers,
    },
  })
}
