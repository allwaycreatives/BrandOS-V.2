// Discovery question set for BrandOS.
// Questions 1, 2, 5, and 8 below are built around Caleb Ralston's
// "Brand Journey Framework": reverse-engineer from desired outcome →
// what you need to be known for → what you need to do → what you need
// to learn. The rest (style, audience, tone, anti-values, platforms)
// round it out into a full but short positioning exercise.

export type DiscoveryQuestion = {
  id: string
  prompt: string
  helper: string
  type: 'choice' | 'multi-select' | 'text'
  options?: string[]
}

export const discoveryQuestions: DiscoveryQuestion[] = [
  {
    id: 'desired_outcome',
    prompt: "What do you actually want this brand to create for you?",
    helper: "Start at the end. Not 'more followers' — the real result you're after.",
    type: 'choice',
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
  },
  {
    id: 'origin_story',
    prompt: "What's the real story behind why you're doing this?",
    helper: "A couple of sentences — the honest version, not the polished one.",
    type: 'text',
  },
  {
    id: 'brand_style',
    prompt: 'Which of these feels most like the brand you want to build?',
    helper: "There's no wrong answer — this shapes tone, visuals, and content style.",
    type: 'choice',
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
  },
  {
    id: 'tone_words',
    prompt: 'Pick the words that sound like you.',
    helper: 'Choose as many as genuinely fit — this shapes your bios and captions.',
    type: 'multi-select',
    options: ['Playful', 'Authoritative', 'Warm', 'Bold', 'Minimal', 'Witty', 'Calm', 'Edgy', 'Empathetic', 'Direct'],
  },
  {
    id: 'anti_values',
    prompt: "What are you proudly NOT about?",
    helper: 'Naming what you reject is as powerful as naming what you stand for.',
    type: 'text',
  },
  {
    id: 'primary_cta',
    prompt: 'After someone sees your content, what do you want them to actually do?',
    helper: "The one action that matters most right now — everything else is secondary.",
    type: 'choice',
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
  },
  {
    id: 'monetization',
    prompt: 'How does — or will — this brand actually make money?',
    helper: "Be specific: products, services, sponsorships, ad revenue, affiliate — whatever applies.",
    type: 'text',
  },
  {
    id: 'current_marketing',
    prompt: "What are you currently doing, if anything, to market yourself?",
    helper: "Honest answer, even if it's 'nothing yet' — this tells us where to start.",
    type: 'text',
  },
  {
    id: 'platforms',
    prompt: 'Which platforms matter most right now?',
    helper: 'Pick your priorities — we can always add more later.',
    type: 'multi-select',
    options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Facebook', 'X'],
  },
]
