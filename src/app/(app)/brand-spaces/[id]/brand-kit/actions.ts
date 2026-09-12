'use server'

import { db } from '@/lib/db'
import { generateText } from '@/lib/ai'
import { revalidatePath } from 'next/cache'

type DiscoveryAnswers = Record<string, string | string[]>

export async function generateBrandKit(brandSpaceId: string) {
  const response = await db.discoveryResponse.findFirst({
    where: { brandSpaceId },
    orderBy: { submittedAt: 'desc' },
  })
  if (!response) return

  const answers = response.answersJson as DiscoveryAnswers
  const toneWords = Array.isArray(answers.tone_words) ? answers.tone_words.join(', ') : ''

  const prompt = `You are a branding assistant. Based on these discovery answers, generate brand identity options.

Desired outcome: ${answers.desired_outcome}
Wants to be known for: ${answers.known_for}
Origin story: ${answers.origin_story}
Brand style: ${answers.brand_style}
Audience: ${answers.audience}
Tone words: ${toneWords}
Proudly not about: ${answers.anti_values}

Return ONLY valid JSON, with no other text before or after it, in exactly this shape:
{"bios": ["bio option 1", "bio option 2", "bio option 3"], "taglines": ["tagline option 1", "tagline option 2", "tagline option 3"]}

Bios should be 1-2 sentences, first person, suitable for a social media bio, reflecting the tone words. Taglines should each be under 8 words.`

  const raw = await generateText(prompt)
  const cleaned = raw.replace(/```json|```/g, '').trim()

  let parsed: { bios: unknown[]; taglines: unknown[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`AI response wasn't valid JSON. Raw response: ${raw.slice(0, 300)}`)
  }

  // Gemini doesn't always follow the exact requested shape as reliably as
  // Claude does — coerce whatever comes back into plain strings so a
  // slightly-off response can't crash the page when it renders.
  function toText(value: unknown): string {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>
      const candidate = obj.text ?? obj.bio ?? obj.tagline ?? obj.value
      if (typeof candidate === 'string') return candidate
    }
    return String(value ?? '')
  }

  const bios = Array.isArray(parsed.bios) ? parsed.bios.map(toText).filter(Boolean) : []
  const taglines = Array.isArray(parsed.taglines) ? parsed.taglines.map(toText).filter(Boolean) : []

  if (bios.length === 0 && taglines.length === 0) {
    throw new Error(`AI response didn't contain any usable bios or taglines. Raw response: ${raw.slice(0, 300)}`)
  }

  // Regenerating replaces unselected drafts — whatever's already selected
  // and saved is left alone.
  await db.brandKitItem.deleteMany({ where: { brandSpaceId, isSelected: false } })

  await db.brandKitItem.createMany({
    data: [
      ...bios.map((text) => ({ brandSpaceId, type: 'bio', contentJson: { text } })),
      ...taglines.map((text) => ({ brandSpaceId, type: 'tagline', contentJson: { text } })),
    ],
  })

  revalidatePath(`/brand-spaces/${brandSpaceId}/brand-kit`)
}

export async function selectBrandKitItem(brandSpaceId: string, itemId: string, type: string) {
  await db.brandKitItem.updateMany({ where: { brandSpaceId, type }, data: { isSelected: false } })
  await db.brandKitItem.update({ where: { id: itemId }, data: { isSelected: true } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/brand-kit`)
}
