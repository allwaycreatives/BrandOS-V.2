'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

type QuestionInput = { section: string; prompt: string; helper: string }

export async function saveCustomTemplate(brandSpaceId: string, name: string, questions: QuestionInput[]) {
  const cleaned = questions
    .filter((q) => q.prompt.trim().length > 0)
    .map((q, i) => ({
      id: `q_${i}`,
      section: q.section.trim() || undefined,
      prompt: q.prompt.trim(),
      helper: q.helper.trim() || undefined,
    }))

  if (cleaned.length === 0) return

  // Only one active template per brand space at a time.
  await db.discoveryTemplate.updateMany({ where: { brandSpaceId }, data: { isActive: false } })

  const template = await db.discoveryTemplate.create({
    data: { brandSpaceId, name: name.trim() || 'Custom questionnaire', format: 'longform', isActive: true },
  })

  await db.discoveryTemplateVersion.create({
    data: { templateId: template.id, versionNumber: 1, questionsJson: cleaned },
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/discovery/template`)
}

export async function revertToDefaultTemplate(brandSpaceId: string) {
  await db.discoveryTemplate.updateMany({ where: { brandSpaceId }, data: { isActive: false } })
  revalidatePath(`/brand-spaces/${brandSpaceId}`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/discovery/template`)
}
