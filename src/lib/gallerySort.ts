// Putting a gallery's photos in order and into sections. Safe to use in the browser and on the server.

export type SortMode = 'name' | 'date' | 'date_desc'
export const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: 'date', label: 'Date taken, oldest first' },
  { value: 'date_desc', label: 'Date taken, newest first' },
  { value: 'name', label: 'File name' },
]

type Sortable = { name: string; capturedAt?: string | Date | null; setId?: string | null }

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
const time = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : NaN)

export function sortItems<T extends Sortable>(items: T[], mode: string): T[] {
  const list = [...items]
  if (mode === 'name') return list.sort(byName)
  const dir = mode === 'date_desc' ? -1 : 1
  return list.sort((a, b) => {
    const ta = time(a.capturedAt)
    const tb = time(b.capturedAt)
    const hasA = !isNaN(ta)
    const hasB = !isNaN(tb)
    if (hasA && hasB && ta !== tb) return (ta - tb) * dir
    if (hasA !== hasB) return hasA ? -1 : 1 // photos without a date go last
    return byName(a, b) // same moment (or no dates at all): keep the file-name order
  })
}

export type Section<T> = { id: string | null; name: string; items: T[] }

/** The first section holds photos that were not put in a set; then one section per set, in the order you chose. */
export function sectionize<T extends Sortable>(items: T[], sets: { id: string; name: string }[], mainName: string, mode: string): Section<T>[] {
  const main = items.filter((i) => !i.setId || !sets.some((s) => s.id === i.setId))
  const out: Section<T>[] = [{ id: null, name: mainName || 'Photos', items: sortItems(main, mode) }]
  for (const s of sets) out.push({ id: s.id, name: s.name, items: sortItems(items.filter((i) => i.setId === s.id), mode) })
  return out
}
