// Discovery question set for BrandOS.
// Questions are tagged with a `track` so the flow can be filtered based
// on what the person actually wants help with (brand identity, marketing,
// or both) — see the `engagementType` selector in DiscoveryForm.tsx.

export type DiscoveryQuestion = {
  id: string
  prompt: string
  helper: string
  type: 'choice' | 'multi-select' | 'text'
  options?: string[]
  track: 'brand' | 'marketing' | 'both'
}

export const discoveryQuestions: DiscoveryQuestion[] = [
  {
    id: 'desired_outcome',
    prompt: "What do you actually want this brand to create for you?",
    helper: "Start at the end. Not 'more followers' — the real result you're after.",
    type: 'choice',
    track: 'brand',
    options: [
      'More premium clients or customers',
      'Recognition/authority in my industry',
      'An audience for a product or business',
      'Speaking, media, or partnership opportunities',
      'A community around something I care about',
    ],
  },
  {
    id: 'known_for',
    prompt: 'To make that happen, what do you want to be known for?',
    helper: "One sentence. e.g. \"the person who makes investing simple for beginners.\"",
    type: 'text',
    track: 'brand',
  },
  {
    id: 'origin_story',
    prompt: "What's the real story behind why you're doing this?",
    helper: "A couple of sentences — the honest version, not the polished one.",
    type: 'text',
    track: 'brand',
  },
  {
    id: 'brand_style',
    prompt: 'Which of these feels most like the brand you want to build?',
    helper: "There's no wrong answer — this shapes tone, visuals, and content style.",
    type: 'choice',
    track: 'brand',
    options: [
      'Relatable & personal — people follow me for me',
      'A built world — a distinct aesthetic and vocabulary people opt into',
      'Expert & authority — the trusted voice in a specific niche',
      'Aspirational — showing a lifestyle or result people want for themselves',
    ],
  },
  {
    id: 'audience',
    prompt: 'Who, specifically, are you trying to reach?',
    helper: "Not \"everyone.\" Describe one real person — their situation, not just demographics.",
    type: 'text',
    track: 'both',
  },
  {
    id: 'tone_words',
    prompt: 'Pick the words that sound like you.',
    helper: 'Choose as many as genuinely fit — this shapes your bios and captions.',
    type: 'multi-select',
    track: 'brand',
    options: ['Playful', 'Authoritative', 'Warm', 'Bold', 'Minimal', 'Witty', 'Calm', 'Edgy', 'Empathetic', 'Direct'],
  },
  {
    id: 'anti_values',
    prompt: "What are you proudly NOT about?",
    helper: 'Naming what you reject is as powerful as naming what you stand for.',
    type: 'text',
    track: 'brand',
  },
  {
    id: 'primary_cta',
    prompt: 'After someone sees your content, what do you want them to actually do?',
    helper: "The one action that matters most right now — everything else is secondary.",
    type: 'choice',
    track: 'marketing',
    options: [
      'Follow for more',
      'Visit my website or shop',
      'DM me or book a call',
      'Join my email list',
      'Buy now',
    ],
  },
  {
    id: 'lead_magnet',
    prompt: "Do you have (or want) a free offer to pull people in — a guide, checklist, discount, template?",
    helper: "If you don't have one yet, describe what you'd want it to be.",
    type: 'text',
    track: 'marketing',
  },
  {
    id: 'monetization',
    prompt: 'How does — or will — this brand actually make money?',
    helper: "Be specific: products, services, sponsorships, ad revenue, affiliate — whatever applies.",
    type: 'text',
    track: 'marketing',
  },
  {
    id: 'current_marketing',
    prompt: "What are you currently doing, if anything, to market yourself?",
    helper: "Honest answer, even if it's 'nothing yet' — this tells us where to start.",
    type: 'text',
    track: 'marketing',
  },
  {
    id: 'platforms',
    prompt: 'Which platforms matter most right now?',
    helper: 'Pick your priorities — we can always add more later.',
    type: 'multi-select',
    track: 'both',
    options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Facebook', 'X'],
  },
]

export const engagementTypes = [
  { id: 'brand', label: 'Just my brand', description: "Identity, positioning, how I show up online." },
  { id: 'marketing', label: 'Just marketing', description: "I've got the brand — I need help getting seen." },
  { id: 'both', label: 'Brand + marketing', description: "Build the brand and help me market it." },
] as const

export function getQuestionsForTrack(track: string): DiscoveryQuestion[] {
  if (track === 'both') return discoveryQuestions
  return discoveryQuestions.filter((q) => q.track === track || q.track === 'both')
}
