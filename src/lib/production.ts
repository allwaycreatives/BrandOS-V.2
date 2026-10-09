import { addDays, parseDay } from './plan'

// How a brand shoots its content. Each preset answers one question: for a post that goes out on day P,
// which day is it filmed? A shoot day is simply a production date that many posts share.
export type ShootRule = {
  preset: 'monthly_one' | 'monthly_two' | 'weekly' | 'lead'
  dates?: string[] // monthly presets: the shoot days (YYYY-MM-DD)
  weekday?: number // weekly: 0 = Sunday ... 6 = Saturday
  leadDays?: number // lead: how many days before publishing
}

export const PRESETS: { key: ShootRule['preset']; label: string; help: string }[] = [
  { key: 'monthly_one', label: 'One shoot a month', help: 'Film everything on a single day.' },
  { key: 'monthly_two', label: 'Two shoots a month', help: 'For example, one early and one mid-month.' },
  { key: 'weekly', label: 'A shoot day every week', help: 'The same weekday, every week.' },
  { key: 'lead', label: 'Just in time', help: 'A set number of days before each post goes out.' },
]

const dow = (key: string) => (parseDay(key) as Date).getUTCDay()

// The shoot day for a post published on `publish`, or null when the rule has no shoot day on or before it.
export function shootDayFor(rule: ShootRule, publish: string): string | null {
  if (rule.preset === 'lead') {
    const n = Math.max(0, Math.min(60, Math.floor(rule.leadDays ?? 0)))
    return addDays(publish, -n)
  }
  if (rule.preset === 'weekly') {
    const w = rule.weekday
    if (w === undefined || w < 0 || w > 6) return null
    return addDays(publish, -((dow(publish) - w + 7) % 7))
  }
  const dates = (rule.dates ?? []).filter((d) => parseDay(d)).sort()
  const before = dates.filter((d) => d <= publish)
  return before.length ? before[before.length - 1] : null
}

export type ShootPost = { id: string; publish: string; production: string | null }
export type ShootPlan = {
  assignments: { id: string; day: string }[]
  perDay: { day: string; count: number }[]
  unmatched: number // no shoot day on or before the publish date
  kept: number // already had a production date and were left alone
}

// overwrite=false only fills posts that have no production date yet.
export function planShoots(rule: ShootRule, posts: ShootPost[], overwrite: boolean): ShootPlan {
  const assignments: { id: string; day: string }[] = []
  let unmatched = 0
  let kept = 0
  for (const p of posts) {
    if (p.production && !overwrite) {
      kept++
      continue
    }
    const day = shootDayFor(rule, p.publish)
    if (!day) unmatched++
    else assignments.push({ id: p.id, day })
  }
  const counts = new Map<string, number>()
  for (const a of assignments) counts.set(a.day, (counts.get(a.day) ?? 0) + 1)
  return { assignments, perDay: Array.from(counts, ([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)), unmatched, kept }
}

// Checks a rule that came from the browser before it is used.
export function cleanRule(r: ShootRule): ShootRule | null {
  if (!PRESETS.some((p) => p.key === r.preset)) return null
  const dates = Array.from(new Set((r.dates ?? []).filter((d) => typeof d === 'string' && parseDay(d)))).slice(0, 6)
  if (r.preset === 'monthly_one' && dates.length < 1) return null
  if (r.preset === 'monthly_two' && dates.length < 2) return null
  if (r.preset === 'weekly' && !(Number.isInteger(r.weekday) && (r.weekday as number) >= 0 && (r.weekday as number) <= 6)) return null
  if (r.preset === 'lead' && !(Number.isInteger(r.leadDays) && (r.leadDays as number) >= 0 && (r.leadDays as number) <= 60)) return null
  return { preset: r.preset, dates, weekday: r.weekday, leadDays: r.leadDays }
}
