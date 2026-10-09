'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { assertBrandSpaceAccess } from '@/lib/auth'
import { parseDay } from '@/lib/plan'
import { parseStrategy } from '@/lib/strategy'
import { parsePosts, parseStrategyText, mergeStrategy, MAX_IMPORT_CHARS } from '@/lib/importFormat'

// Importing is for the owner and team only. Nothing is created until commit; preview only reads.
async function requireTeam(brandSpaceId: string) {
  const access = await assertBrandSpaceAccess(brandSpaceId)
  if (!access || access.role === 'client') return null
  return access
}

export type PreviewPost = {
  index: number
  title: string
  platform: string
  contentType: string | null
  pillar: string | null
  publish: string | null
  production: string | null
  hookCount: number
  hasBrief: boolean
  warnings: string[]
  duplicate: boolean
}

export async function previewPostImport(brandSpaceId: string, text: string): Promise<{ ok: boolean; error?: string; posts?: PreviewPost[]; problems?: string[] }> {
  const access = await requireTeam(brandSpaceId)
  if (!access) return { ok: false, error: 'You do not have access to import here.' }
  if (!text.trim()) return { ok: false, error: 'Paste ChatGPT\'s answer first.' }
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That is too long to import in one go. Split it into two batches.' }

  const strategy = parseStrategy(access.brandSpace.strategy)
  const { posts, problems } = parsePosts(text, strategy)
  const existing = await db.calendarItem.findMany({ where: { brandSpaceId }, select: { title: true, platform: true } })
  const seen = new Set(existing.map((e) => `${e.title.trim().toLowerCase()}|${e.platform.toLowerCase()}`))

  return {
    ok: true,
    problems,
    posts: posts.map((p, index) => ({
      index,
      title: p.title,
      platform: p.platform,
      contentType: p.contentType,
      pillar: p.pillar,
      publish: p.publish,
      production: p.production,
      hookCount: p.hookOptions.length,
      hasBrief: !!p.brief,
      warnings: p.warnings,
      duplicate: seen.has(`${p.title.trim().toLowerCase()}|${p.platform.toLowerCase()}`),
    })),
  }
}

// The text is read again here, on the server, so the selection cannot smuggle in anything that was not in the paste.
export async function commitPostImport(brandSpaceId: string, text: string, include: number[], status: 'idea' | 'planned'): Promise<{ ok: boolean; error?: string; created?: number }> {
  const access = await requireTeam(brandSpaceId)
  if (!access) return { ok: false, error: 'You do not have access to import here.' }
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That is too long to import in one go.' }
  const chosen = new Set(include)
  const { posts } = parsePosts(text, parseStrategy(access.brandSpace.strategy))
  const rows = posts.filter((_, i) => chosen.has(i))
  if (rows.length === 0) return { ok: false, error: 'No posts were selected.' }

  await db.calendarItem.createMany({
    data: rows.map((p) => ({
      brandSpaceId,
      title: p.title,
      platform: p.platform,
      status: status === 'planned' ? 'planned' : 'idea',
      contentType: p.contentType,
      priority: p.priority,
      pillar: p.pillar,
      series: p.series,
      scheduledDate: p.publish ? parseDay(p.publish) : null,
      productionDate: p.production ? parseDay(p.production) : null,
      hook: p.hook || null,
      hookOptions: p.hookOptions,
      cta: p.cta || null,
      objective: p.objective || null,
      keyMessage: p.keyMessage || null,
      caption: p.caption || null,
      successMetric: p.successMetric || null,
      notes: p.notes || null,
      script: p.brief || null,
    })),
  })
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
  return { ok: true, created: rows.length }
}

export type StrategyPreview = { lines: string[]; problems: string[] }

export async function previewStrategyImport(brandSpaceId: string, text: string): Promise<{ ok: boolean; error?: string; preview?: StrategyPreview }> {
  const access = await requireTeam(brandSpaceId)
  if (!access) return { ok: false, error: 'You do not have access to import here.' }
  if (!text.trim()) return { ok: false, error: 'Paste ChatGPT\'s answer first.' }
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That is too long to import in one go.' }

  const current = parseStrategy(access.brandSpace.strategy)
  const { strategy: pasted, problems } = parseStrategyText(text)
  const lines: string[] = []
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  if (pasted.mission !== undefined) lines.push(`Mission will be ${current.mission ? 'replaced' : 'set'}.`)
  if (pasted.seasonName !== undefined) lines.push(`Season will be ${current.seasonName ? 'replaced' : 'set'}: ${pasted.seasonName}`)
  if (pasted.seasonStory !== undefined) lines.push(`Season story will be ${current.seasonStory ? 'replaced' : 'set'}.`)
  if (pasted.pillars) lines.push(`${n(pasted.pillars.length, 'pillar', 'pillars')}: ${pasted.pillars.map((p) => p.name + (p.core ? ' (core)' : '')).join(', ')}${current.pillars.length ? ` (replaces ${current.pillars.length})` : ''}`)
  if (pasted.platforms) lines.push(`${n(pasted.platforms.length, 'platform', 'platforms')}: ${pasted.platforms.map((p) => `${p.name} (${p.role}${p.perWeek ? `, ${p.perWeek} a week` : ''})`).join(', ')}${current.platforms.length ? ` (replaces ${current.platforms.length})` : ''}`)
  if (pasted.series) lines.push(`${n(pasted.series.length, 'series', 'series')}: ${pasted.series.map((s) => s.name).join(', ')}${current.series.length ? ` (replaces ${current.series.length})` : ''}`)
  return { ok: true, preview: { lines, problems } }
}

export async function commitStrategyImport(brandSpaceId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const access = await requireTeam(brandSpaceId)
  if (!access) return { ok: false, error: 'You do not have access to import here.' }
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That is too long to import in one go.' }
  const { strategy: pasted } = parseStrategyText(text)
  if (Object.keys(pasted).length === 0) return { ok: false, error: 'Nothing to import.' }
  const merged = mergeStrategy(parseStrategy(access.brandSpace.strategy), pasted)
  await db.brandSpace.update({ where: { id: brandSpaceId }, data: { strategy: merged as unknown as object } })
  revalidatePath(`/brand-spaces/${brandSpaceId}/strategy`)
  revalidatePath(`/brand-spaces/${brandSpaceId}/calendar`)
  return { ok: true }
}
