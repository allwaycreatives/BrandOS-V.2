export const STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'planned', label: 'Planned' },
  { key: 'in_production', label: 'In production' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
] as const

export const STATUS_LABEL: Record<string, string> = { planning: 'Planning', live: 'Live', done: 'Done' }
export const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'X', 'Facebook']
