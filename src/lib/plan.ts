// Dates in the content plan are whole days, stored as midnight UTC and always shown in UTC,
// so a post never slips to the neighbouring day depending on who is looking or where.

export const dayKey = (d: Date) => d.toISOString().slice(0, 10)

export function parseDay(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null
  const d = new Date(`${key}T00:00:00.000Z`)
  return isNaN(d.getTime()) || dayKey(d) !== key ? null : d
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key) as Date
  d.setUTCDate(d.getUTCDate() + n)
  return dayKey(d)
}

// Weeks start on Monday.
export function mondayOf(key: string): string {
  const d = parseDay(key) as Date
  return addDays(key, -((d.getUTCDay() + 6) % 7))
}

export const todayKey = () => dayKey(new Date())

const fmt = (key: string, opts: Intl.DateTimeFormatOptions) => (parseDay(key) as Date).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts })
export const dayLabel = (key: string) => fmt(key, { weekday: 'short', day: 'numeric', month: 'short' })
export const dayLong = (key: string) => fmt(key, { weekday: 'long', day: 'numeric', month: 'long' })
export const weekdayShort = (key: string) => fmt(key, { weekday: 'short' })
export const dayNumber = (key: string) => fmt(key, { day: 'numeric' })
export const monthKeyOf = (key: string) => key.slice(0, 7)
export const monthTitle = (monthKey: string) => (parseDay(`${monthKey}-01`) as Date).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' })
export const lastDayOf = (monthKey: string) => {
  const d = parseDay(`${monthKey}-01`) as Date
  d.setUTCMonth(d.getUTCMonth() + 1, 0)
  return dayKey(d)
}
// A day's number for the calendar grid; the first of a month also shows the month, like "1 Nov".
export const gridDayLabel = (key: string) => (key.endsWith('-01') ? fmt(key, { day: 'numeric', month: 'short' }) : dayNumber(key))
export const weekLabel = (mondayKey: string) => `${fmt(mondayKey, { day: 'numeric', month: 'short' })} – ${fmt(addDays(mondayKey, 6), { day: 'numeric', month: 'short' })}`

// What the client sees: every post that is not still an idea.
export const visibleToClient = (status: string) => status !== 'idea'

export const CLIENT_STATUS_TEAM: Record<string, string> = { pending: 'Not reviewed yet', changes_requested: 'Changes requested', approved: 'Approved' }
export const CLIENT_STATUS_CLIENT: Record<string, string> = { pending: 'Waiting for your review', changes_requested: 'Changes requested', approved: 'Approved' }
export const KIND_WORD: Record<string, string> = { comment: 'Comment', changes_requested: 'Requested changes', approved: 'Approved' }
