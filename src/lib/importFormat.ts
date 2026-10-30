import { parseDay } from './plan'
import { CONTENT_TYPES } from './contentOptions'
import { parseStrategy, type Strategy } from './strategy'

// ---------------------------------------------------------------------------
// The "Brand Console format": a plain document that ChatGPT (or anyone) writes and Brand Console reads.
// One block per post, laid out like the post panel: title, properties, then the brief at the bottom.
// The parser is forgiving about bold marks, bullets, numbering and capital letters, and it never guesses
// silently: anything it could not understand becomes a warning shown in the preview.
// ---------------------------------------------------------------------------

export const IMPORT_PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X', 'Facebook']
export const MAX_IMPORT_POSTS = 60
export const MAX_IMPORT_CHARS = 80_000

export type ParsedPost = {
  title: string
  platform: string
  contentType: string | null
  pillar: string | null
  series: string | null
  priority: 'high' | 'normal' | 'low'
  publish: string | null
  production: string | null
  hook: string
  hookOptions: string[]
  cta: string
  objective: string
  keyMessage: string
  caption: string
  successMetric: string
  notes: string
  brief: string
  warnings: string[]
}

type Field = 'platform' | 'format' | 'pillar' | 'series' | 'priority' | 'publish' | 'production' | 'hook' | 'hookOptions' | 'cta' | 'objective' | 'keyMessage' | 'caption' | 'successMetric' | 'notes' | 'brief'

const KEYS: Record<string, Field> = {
  platform: 'platform', channel: 'platform',
  format: 'format', 'content type': 'format', type: 'format',
  pillar: 'pillar', 'content pillar': 'pillar',
  series: 'series',
  priority: 'priority',
  publish: 'publish', 'publish date': 'publish', 'publishing date': 'publish', 'post date': 'publish', date: 'publish',
  production: 'production', 'production date': 'production', 'shoot date': 'production', 'film date': 'production',
  hook: 'hook', 'chosen hook': 'hook',
  'hook options': 'hookOptions', hooks: 'hookOptions', 'hook variations': 'hookOptions', 'alternative hooks': 'hookOptions',
  cta: 'cta', 'call to action': 'cta',
  objective: 'objective', goal: 'objective', purpose: 'objective',
  'main message': 'keyMessage', 'key message': 'keyMessage', message: 'keyMessage',
  caption: 'caption', copy: 'caption',
  'success metric': 'successMetric', metric: 'successMetric', kpi: 'successMetric',
  notes: 'notes',
  brief: 'brief', 'content brief': 'brief', script: 'brief', outline: 'brief', draft: 'brief', 'script/outline': 'brief', 'script or outline': 'brief',
}

const KEY_LINE = /^\s*(?:[-*•]\s+)?[*_]{0,2}\s*([^:*_\n]{2,26}?)\s*[*_]{0,2}\s*:\s*[*_]{0,2}\s*(.*)$/
const stripMarks = (s: string) => s.replace(/^[*_\s]+|[*_\s]+$/g, '').trim()

function keyOf(line: string): { field: Field; value: string } | null {
  const m = KEY_LINE.exec(line)
  if (!m) return null
  const field = KEYS[m[1].trim().toLowerCase()]
  return field ? { field, value: stripMarks(m[2]) } : null
}

export function formatKey(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  const exact = CONTENT_TYPES.find((t) => t.key === s || t.label.toLowerCase() === s)
  if (exact) return exact.key
  if (/(short|reel|tiktok|^video$|shorts)/.test(s)) return 'short_video'
  if (/(long|youtube|episode)/.test(s)) return 'long_video'
  if (/carousel|slides/.test(s)) return 'carousel'
  if (/(image|photo|picture|graphic)/.test(s)) return 'image'
  if (/(text|thread|status)/.test(s)) return 'text'
  if (/story|stories/.test(s)) return 'story'
  if (/live/.test(s)) return 'live'
  if (/(article|blog|newsletter)/.test(s)) return 'article'
  return null
}

function isoDate(raw: string): string | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw.trim())
  if (!m) return null
  const key = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return parseDay(key) ? key : null
}

const cleanTitle = (raw: string) =>
  stripMarks(raw.replace(/^#+\s*/, '').replace(/^(post|idea|content)?\s*#?\d+\s*[:.)\-–—]\s*/i, '').replace(/^["“]|["”]$/g, '')).slice(0, 200)

export function parsePosts(text: string, strategy: Strategy, defaultPlatform = 'Instagram'): { posts: ParsedPost[]; problems: string[] } {
  const problems: string[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')

  // Posts start at "## Title" lines. If there are none, "# Title" lines are used instead.
  let level = /^##\s+\S/m.test(text) && lines.some((l) => /^##\s+\S/.test(l) && !/^###/.test(l)) ? '##' : '#'
  const isStart = (l: string) => (level === '##' ? /^##\s+\S/.test(l) && !/^###/.test(l) : /^#\s+\S/.test(l))
  if (!lines.some(isStart)) return { posts: [], problems: ['I could not find any posts. Each post should start with a line like "## Post title".'] }

  const blocks: { title: string; body: string[] }[] = []
  for (const line of lines) {
    if (isStart(line)) blocks.push({ title: cleanTitle(line), body: [] })
    else if (blocks.length) blocks[blocks.length - 1].body.push(line)
  }

  const pillarByLower = new Map(strategy.pillars.map((p) => [p.name.toLowerCase(), p.name]))
  const seriesByLower = new Map(strategy.series.map((s) => [s.name.toLowerCase(), s.name]))
  const platformByLower = new Map([...IMPORT_PLATFORMS, ...strategy.platforms.map((p) => p.name)].map((p) => [p.toLowerCase(), p]))

  const posts: ParsedPost[] = []
  for (const block of blocks) {
    const warnings: string[] = []
    const vals: Partial<Record<Field, string>> = {}
    const hookOptions: string[] = []
    let current: Field | null = null
    let inBrief = false
    const briefLines: string[] = []

    for (const line of block.body) {
      if (inBrief) {
        briefLines.push(line)
        continue
      }
      const k = keyOf(line)
      if (k) {
        current = k.field
        if (k.field === 'brief') {
          inBrief = true
          if (k.value) briefLines.push(k.value)
        } else if (k.field === 'hookOptions') {
          if (k.value) hookOptions.push(...k.value.split(/\s+\/\s+|\s*;\s*|\s+\|\s+/).map(stripMarks).filter(Boolean))
        } else {
          vals[k.field] = k.value
        }
        continue
      }
      if (current === 'hookOptions') {
        const b = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line)
        if (b && stripMarks(b[1])) hookOptions.push(stripMarks(b[1]))
        continue
      }
      if (current && line.trim()) vals[current] = `${vals[current] ?? ''}${vals[current] ? '\n' : ''}${stripMarks(line)}`
    }

    let brief = briefLines.join('\n').trim()
    brief = brief.replace(/\n+\s*(?:---+|\*\*\*+)\s*$/g, '').trim() // a trailing divider line

    const title = block.title
    if (!title) {
      problems.push('One post has no title and was skipped.')
      continue
    }

    // Platform
    let platform = (vals.platform ?? '').trim()
    if (!platform) {
      platform = (strategy.platforms.find((p) => p.role === 'primary')?.name || defaultPlatform)
      warnings.push(`No platform given, so it will use ${platform}.`)
    } else {
      const known = platformByLower.get(platform.toLowerCase())
      if (known) platform = known
      else warnings.push(`"${platform}" is not one of your usual platforms.`)
    }

    // Format
    let contentType: string | null = null
    if (vals.format) {
      contentType = formatKey(vals.format)
      if (!contentType) warnings.push(`I did not recognise the format "${vals.format}", so it is left blank.`)
    }

    // Pillar and series: matched to the strategy where possible, and flagged when they are not in it.
    let pillar: string | null = null
    if (vals.pillar) {
      const hit = pillarByLower.get(vals.pillar.toLowerCase())
      pillar = hit ?? vals.pillar.slice(0, 80)
      if (!hit && strategy.pillars.length > 0) warnings.push(`The pillar "${vals.pillar}" is not in your strategy.`)
    }
    let series: string | null = null
    if (vals.series) {
      const hit = seriesByLower.get(vals.series.toLowerCase())
      series = hit ?? vals.series.slice(0, 80)
      if (!hit && strategy.series.length > 0) warnings.push(`The series "${vals.series}" is not in your strategy.`)
    }

    // Priority
    let priority: ParsedPost['priority'] = 'normal'
    if (vals.priority) {
      const p = vals.priority.toLowerCase()
      if (p.startsWith('high') || p === 'urgent') priority = 'high'
      else if (p.startsWith('low')) priority = 'low'
      else if (!p.startsWith('norm') && !p.startsWith('med')) warnings.push(`I did not recognise the priority "${vals.priority}", so it is Normal.`)
    }

    // Dates
    let publish: string | null = null
    if (vals.publish) {
      publish = isoDate(vals.publish)
      if (!publish) warnings.push(`The publish date "${vals.publish}" is not in the form 2026-11-04, so it is left blank.`)
    }
    let production: string | null = null
    if (vals.production) {
      production = isoDate(vals.production)
      if (!production) warnings.push(`The production date "${vals.production}" is not in the form 2026-11-04, so it is left blank.`)
    }
    if (publish && production && production > publish) warnings.push('The production date is after the publish date.')

    // The chosen hook: if none is given but options are, nothing is chosen for you.
    const cut = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n)

    posts.push({
      title,
      platform: platform.slice(0, 40),
      contentType,
      pillar,
      series,
      priority,
      publish,
      production,
      hook: cut(vals.hook, 300),
      hookOptions: hookOptions.map((h) => h.slice(0, 300)).slice(0, 12),
      cta: cut(vals.cta, 500),
      objective: cut(vals.objective, 1000),
      keyMessage: cut(vals.keyMessage, 500),
      caption: cut(vals.caption, 5000),
      successMetric: cut(vals.successMetric, 500),
      notes: cut(vals.notes, 3000),
      brief: brief.slice(0, 20000),
      warnings,
    })
  }

  if (posts.length > MAX_IMPORT_POSTS) {
    problems.push(`There are ${posts.length} posts. Only the first ${MAX_IMPORT_POSTS} will be read. Import the rest in a second batch.`)
    posts.length = MAX_IMPORT_POSTS
  }
  return { posts, problems }
}

// ---------------------------------------------------------------------------
// Strategy format
// ---------------------------------------------------------------------------

const STRATEGY_KEYS: Record<string, 'mission' | 'seasonName' | 'seasonStory' | 'pillars' | 'platforms' | 'series'> = {
  mission: 'mission', 'brand mission': 'mission',
  season: 'seasonName', 'season name': 'seasonName', chapter: 'seasonName',
  'season story': 'seasonStory', story: 'seasonStory',
  pillars: 'pillars', 'content pillars': 'pillars',
  platforms: 'platforms', 'platform strategy': 'platforms',
  series: 'series', 'signature series': 'series',
}

export function parseStrategyText(text: string): { strategy: Partial<Strategy>; problems: string[] } {
  const problems: string[] = []
  const out: Partial<Strategy> = {}
  let section: keyof typeof out | null = null
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const listed: Record<string, string[]> = { pillars: [], platforms: [], series: [] }
  const prose: Record<string, string> = {}

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || /^#+\s*$/.test(line)) continue
    const head = /^(?:#+\s*)?[*_]{0,2}\s*([^:*_\n]{2,26}?)\s*[*_]{0,2}\s*:\s*[*_]{0,2}\s*(.*)$/.exec(line)
    const key = head ? STRATEGY_KEYS[head[1].trim().toLowerCase()] : undefined
    if (head && key) {
      section = key
      const rest = stripMarks(head[2])
      if (rest && (key === 'mission' || key === 'seasonName' || key === 'seasonStory')) prose[key] = rest
      continue
    }
    const bullet = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line)
    if (section === 'pillars' || section === 'platforms' || section === 'series') {
      if (bullet) listed[section].push(stripMarks(bullet[1]))
      continue
    }
    if (section === 'mission' || section === 'seasonName' || section === 'seasonStory') {
      prose[section] = `${prose[section] ?? ''}${prose[section] ? '\n' : ''}${stripMarks(line)}`
    }
  }

  if (prose.mission) out.mission = prose.mission.slice(0, 600)
  if (prose.seasonName) out.seasonName = prose.seasonName.slice(0, 120)
  if (prose.seasonStory) out.seasonStory = prose.seasonStory.slice(0, 1500)

  const split = (s: string) => s.split(/\s+\|\s+|\s*\|\s*/).map(stripMarks)

  if (listed.pillars.length) {
    out.pillars = listed.pillars.map((l) => {
      // "Name | core | one line"  or  "Name (core) - one line"
      const parts = split(l)
      if (parts.length >= 2) {
        const core = parts.some((p) => p.toLowerCase() === 'core')
        const rest = parts.slice(1).filter((p) => p.toLowerCase() !== 'core' && p.toLowerCase() !== 'supporting')
        return { name: parts[0].replace(/\s*\(core\)\s*/i, '').trim(), line: rest.join(' ').trim(), core: core || /\(core\)/i.test(parts[0]) }
      }
      const m = /^(.*?)(\(core\))?\s*(?:—|–| - |:)\s*(.*)$/i.exec(l)
      return m ? { name: m[1].trim(), line: m[3].trim(), core: !!m[2] } : { name: l.replace(/\s*\(core\)\s*/i, '').trim(), line: '', core: /\(core\)/i.test(l) }
    })
  }
  if (listed.platforms.length) {
    out.platforms = listed.platforms.map((l) => {
      // "Instagram | primary | 3.5 per week | Come watch the journey"
      const parts = split(l)
      const role = (['primary', 'secondary', 'supporting'].find((r) => parts.some((p) => p.toLowerCase() === r)) ?? 'supporting') as 'primary' | 'secondary' | 'supporting'
      const perWeekPart = parts.find((p) => /\d/.test(p) && /(week|wk|\/w|x)/i.test(p))
      const monthPart = parts.find((p) => /\d/.test(p) && /month/i.test(p))
      const n = perWeekPart ? parseFloat((perWeekPart.match(/\d+(?:\.\d+)?/) ?? ['0'])[0]) : monthPart ? parseFloat((monthPart.match(/\d+(?:\.\d+)?/) ?? ['0'])[0]) / 4 : 0
      const rest = parts.slice(1).filter((p) => p !== perWeekPart && p !== monthPart && !['primary', 'secondary', 'supporting'].includes(p.toLowerCase()))
      return { name: parts[0], role, perWeek: Math.round(n * 100) / 100, expression: rest.join(' ').trim() }
    })
  }
  if (listed.series.length) {
    out.series = listed.series.map((l) => {
      const parts = split(l)
      return { name: parts[0], pillar: parts.length >= 3 ? parts[1] : '', line: parts.length >= 3 ? parts.slice(2).join(' ') : parts.slice(1).join(' ') }
    })
  }

  if (Object.keys(out).length === 0) problems.push('I could not find a mission, season, pillars, platforms or series. Check that the headings end with a colon, like "Pillars:".')
  return { strategy: out, problems }
}

// Merges what was pasted over what is stored: any section that was pasted replaces that section; the rest is untouched.
export function mergeStrategy(current: Strategy, pasted: Partial<Strategy>): Strategy {
  const merged = { ...current, ...pasted }
  const clean = parseStrategy(merged)
  const names = new Set(clean.pillars.map((p) => p.name))
  clean.series = clean.series.map((s) => ({ ...s, pillar: names.has(s.pillar) ? s.pillar : '' }))
  return clean
}
