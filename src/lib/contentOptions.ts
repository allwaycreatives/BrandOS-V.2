// The formats a post can have. The brief adapts to the format: a text post does not ask for a video production plan.
export const CONTENT_TYPES = [
  { key: 'short_video', label: 'Short video (Reel, TikTok, Short)', video: true, scriptLabel: 'Script or outline' },
  { key: 'long_video', label: 'Long video', video: true, scriptLabel: 'Script or outline' },
  { key: 'carousel', label: 'Carousel', video: false, scriptLabel: 'Slide-by-slide outline' },
  { key: 'image', label: 'Image post', video: false, scriptLabel: 'Draft or outline' },
  { key: 'text', label: 'Text post', video: false, scriptLabel: 'Draft' },
  { key: 'story', label: 'Story', video: true, scriptLabel: 'Outline' },
  { key: 'live', label: 'Live', video: true, scriptLabel: 'Run of show' },
  { key: 'article', label: 'Article', video: false, scriptLabel: 'Outline or draft' },
] as const

export const typeOf = (key: string | null | undefined) => CONTENT_TYPES.find((t) => t.key === key)

export const PRIORITIES = [
  { key: 'high', label: 'High' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Low' },
] as const
