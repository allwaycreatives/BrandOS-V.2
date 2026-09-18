'use server'

import { db } from '@/lib/db'
import { discoveryQuestions } from '@/lib/discoveryQuestions'

// Resolves which template version a submission belongs to: a custom,
// agency-defined template if one is marked active for this brand space,
// otherwise the default swipeable quiz (auto-created on first use).
async function getActiveTemplateVersion(brandSpaceId: string) {
  const activeTemplate = await db.discoveryTemplate.findFirst({
    where: { brandSpaceId, isActive: true },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  })
  if (activeTemplate?.versions[0]) {
    return activeTemplate.versions[0]
  }

  const defaultTemplate = await db.discoveryTemplate.findFirst({
    where: { brandSpaceId, isDefault: true },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  })
  if (defaultTemplate?.versions[0]) {
    return defaultTemplate.versions[0]
  }

  const template = await db.discoveryTemplate.create({
    data: { brandSpaceId, name: 'Default discovery', isDefault: true, isActive: false, format: 'quiz' },
  })

  return db.discoveryTemplateVersion.create({
    data: { templateId: template.id, versionNumber: 1, questionsJson: discoveryQuestions },
  })
}

export async function submitDiscoveryResponse(brandSpaceId: string, answers: Record<string, string | string[]>) {
  const templateVersion = await getActiveTemplateVersion(brandSpaceId)

  await db.discoveryResponse.create({
    data: {
      brandSpaceId,
      templateVersionId: templateVersion.id,
      answersJson: answers,
    },
  })
}
