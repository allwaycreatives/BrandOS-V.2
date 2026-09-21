'use server'

import { db } from '@/lib/db'
import { generateText } from '@/lib/ai'
import { revalidatePath } from 'next/cache'

type DiscoveryAnswers = Record<string, string | string[]>

const PLATFORM_GUIDANCE: Record<string, string> = {
  Instagram: 'bio under 150 characters, casual line breaks allowed',
  TikTok: 'bio under 80 characters, punchy and casual',
  YouTube: 'about section 2-3 sentences, can be slightly longer and more descriptive',
  LinkedIn: 'headline under 220 characters, professional tone',
  Facebook: 'page intro under 100 characters',
  X: 'bio under 160 characters, sharp and direct',
}

type LongFormQuestion = { id: string; section?: string; prompt: string; helper?: string }

export async function generateBrandKit(brandSpaceId: string) {
  const response = await db.discoveryResponse.findFirst({
    where: { brandSpaceId },
    orderBy: { submittedAt: 'desc' },
    include: { templateVersion: { include: { template: true } } },
  })
  if (!response) return

  const answers = response.answersJson as DiscoveryAnswers
  const isCustomTemplate = response.templateVersion?.template?.format === 'longform'

  let knownAnswers: string
  let platforms: string[]
  let customTemplateNote = ''

  if (isCustomTemplate) {
    // This brand space used a custom, agency-built questionnaire (like a
    // deep business intake) instead of the default identity quiz — build
    // the answer summary from whatever questions were actually asked,
    // instead of looking for fields (known_for, tone_words, etc.) that
    // simply don't exist for this kind of template.
    const customQuestions = (response.templateVersion?.questionsJson as LongFormQuestion[]) || []
    knownAnswers = customQuestions
      .map((q) => {
        const value = answers[q.id]
        if (!value) return null
        const answerText = Array.isArray(value) ? value.join(', ') : value
        return `${q.section ? `[${q.section}] ` : ''}${q.prompt}: ${answerText}`
      })
      .filter(Boolean)
      .join('\n')
    platforms = Array.isArray(answers.platforms) && answers.platforms.length > 0 ? answers.platforms : ['Instagram']
    customTemplateNote = `\nNote: these answers come from a custom business questionnaire, not a personal-brand identity quiz — write based on the business facts given, not assumed personality traits.\n`
  } else {
    const toneWords = Array.isArray(answers.tone_words) ? answers.tone_words.join(', ') : ''
    const desiredOutcomes = Array.isArray(answers.desired_outcome)
      ? answers.desired_outcome.join(', ')
      : (answers.desired_outcome as string) || undefined
    const brandStyleAnswer = answers.brand_style
    const brandStyle = Array.isArray(brandStyleAnswer)
      ? brandStyleAnswer.length > 1
        ? `${brandStyleAnswer[0]} (this is the PRIMARY lens — lead with this), blended with a supporting layer of: ${brandStyleAnswer.slice(1).join(', ')}`
        : brandStyleAnswer[0]
      : (brandStyleAnswer as string) || undefined
    platforms = Array.isArray(answers.platforms) && answers.platforms.length > 0 ? answers.platforms : ['Instagram']

    const fieldLabels: [string, string | undefined][] = [
      ['Desired outcome(s)', desiredOutcomes],
      ['Wants to be known for', answers.known_for as string],
      ['Origin story', answers.origin_story as string],
      ['Brand style', brandStyle],
      ['Audience', answers.audience as string],
      ['Tone words', toneWords || undefined],
      ['Proudly not about', answers.anti_values as string],
      ['Main action they want people to take', answers.primary_cta as string],
      ['Lead magnet / free offer', answers.lead_magnet as string],
      ['Monetization', answers.monetization as string],
    ]
    knownAnswers = fieldLabels
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n')
  }

  const platformInstructions = platforms
    .map((p) => `- ${p}: ${PLATFORM_GUIDANCE[p] || 'a short, platform-appropriate bio'}`)
    .join('\n')

  const prompt = `You are a branding assistant. Based on these discovery answers, generate platform-specific brand kit content.
${customTemplateNote}
${knownAnswers}

Generate content for exactly these platforms, following each platform's length guidance:
${platformInstructions}

For EACH platform, generate exactly TWO distinct options (optionA and optionB) so the person can choose. Each option needs:
- "bio": the actual bio/headline text for that platform, respecting its length guidance
- "tagline": a short call-to-action or tagline, under 8 words, aligned with the main action they want people to take
- "profilePicture": a one-sentence description of what the profile picture should look like/feel like (crop, mood, style — not a literal image, just direction)
- "highlights": ONLY for Instagram, an array of 4-6 short Instagram Highlight cover titles (2-3 words each) that fit this brand. Omit this field entirely for all other platforms.

Return ONLY valid JSON, no other text, in exactly this shape:
{"platformKits": {"<PlatformName>": {"optionA": {"bio": "...", "tagline": "...", "profilePicture": "...", "highlights": ["...", "..."]}, "optionB": {...}}, "<NextPlatform>": {...}}}`

  const raw = await generateText(prompt)
  const cleaned = raw.replace(/```json|```/g, '').trim()

  let parsed: { platformKits?: Record<string, { optionA?: unknown; optionB?: unknown }> }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`AI response wasn't valid JSON. Raw response: ${raw.slice(0, 300)}`)
  }

  const platformKits = parsed.platformKits
  if (!platformKits || typeof platformKits !== 'object') {
    throw new Error(`AI response didn't contain platform kits. Raw response: ${raw.slice(0, 300)}`)
  }

  function normalizeOption(value: unknown): { bio: string; tagline: string; profilePicture: string; highlights?: string[] } | null {
    if (!value || typeof value !== 'object') return null
    const obj = value as Record<string, unknown>
    const bio = typeof obj.bio === 'string' ? obj.bio : ''
    const tagline = typeof obj.tagline === 'string' ? obj.tagline : ''
    const profilePicture = typeof obj.profilePicture === 'string' ? obj.profilePicture : ''
    if (!bio && !tagline && !profilePicture) return null
    const result: { bio: string; tagline: string; profilePicture: string; highlights?: string[] } = { bio, tagline, profilePicture }
    if (Array.isArray(obj.highlights)) {
      result.highlights = obj.highlights.filter((h): h is string => typeof h === 'string')
    }
    return result
  }

  const rowsToInsert: { brandSpaceId: string; type: string; platform: string; contentJson: object }[] = []

  for (const platform of platforms) {
    const kit = platformKits[platform]
    if (!kit) continue
    const optionA = normalizeOption(kit.optionA)
    const optionB = normalizeOption(kit.optionB)
    if (optionA) rowsToInsert.push({ brandSpaceId, type: 'platform_kit', platform, contentJson: optionA })
    if (optionB) rowsToInsert.push({ brandSpaceId, type: 'platform_kit', platform, contentJson: optionB })
  }

  if (rowsToInsert.length === 0) {
    throw new Error(`AI response didn't produce usable content for any platform. Raw response: ${raw.slice(0, 300)}`)
  }

  // Regenerating replaces unselected drafts — whatever's already selected stays.
  await db.brandKitItem.deleteMany({ where: { brandSpaceId, type: 'platform_kit', isSelected: false } })
  await db.brandKitItem.createMany({ data: rowsToInsert })

  revalidatePath(`/brand-spaces/${brandSpaceId}/brand-kit`)
}

export async function selectBrandKitItem(brandSpaceId: string, itemId: string, platform: string) {
  await db.brandKitItem.updateMany({
    where: { brandSpaceId, platform, type: 'platform_kit' },
    data: { isSelected: false },
  })
  await db.brandKitItem.update({ where: { id: itemId }, data: { isSelected: true } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/brand-kit`)
}

export async function setPlatformPriority(brandSpaceId: string, orderedPlatforms: string[]) {
  await db.brandSpace.update({
    where: { id: brandSpaceId },
    data: { platformPriority: orderedPlatforms },
  })
  revalidatePath(`/brand-spaces/${brandSpaceId}/brand-kit`)
}
