// A brand's content strategy: the decisions that guide what gets made. Stored as one document on the brand.
export type Pillar = { name: string; line: string; core: boolean }
export type PlatformRole = { name: string; role: 'primary' | 'secondary' | 'supporting'; perWeek: number; expression: string }
export type Series = { name: string; pillar: string; line: string }
export type Strategy = { mission: string; seasonName: string; seasonStory: string; pillars: Pillar[]; platforms: PlatformRole[]; series: Series[] }

export const emptyStrategy: Strategy = { mission: '', seasonName: '', seasonStory: '', pillars: [], platforms: [], series: [] }

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

// Reads whatever is stored and always returns a safe, well-shaped strategy.
export function parseStrategy(raw: unknown): Strategy {
  if (!raw || typeof raw !== 'object') return emptyStrategy
  const o = raw as Record<string, unknown>
  const list = (v: unknown) => (Array.isArray(v) ? v : [])
  return {
    mission: str(o.mission, 600),
    seasonName: str(o.seasonName, 120),
    seasonStory: str(o.seasonStory, 1500),
    pillars: list(o.pillars)
      .map((p: any) => ({ name: str(p?.name, 80), line: str(p?.line, 300), core: !!p?.core }))
      .filter((p) => p.name)
      .slice(0, 12),
    platforms: list(o.platforms)
      .map((p: any) => ({
        name: str(p?.name, 40),
        role: (['primary', 'secondary', 'supporting'].includes(p?.role) ? p.role : 'supporting') as PlatformRole['role'],
        perWeek: typeof p?.perWeek === 'number' && p.perWeek >= 0 && p.perWeek <= 50 ? p.perWeek : 0,
        expression: str(p?.expression, 200),
      }))
      .filter((p) => p.name)
      .slice(0, 12),
    series: list(o.series)
      .map((p: any) => ({ name: str(p?.name, 80), pillar: str(p?.pillar, 80), line: str(p?.line, 300) }))
      .filter((p) => p.name)
      .slice(0, 40),
  }
}
