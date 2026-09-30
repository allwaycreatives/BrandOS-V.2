// "Who are you?" options in the first-run guide. Each one picks which templates to suggest,
// how to word the name step, and a sensible first task. To add a role, add an entry here.
// Template keys must exist in boards/templates.ts.

export type StarterPack = {
  key: string
  label: string
  blurb: string
  nameTitle: string
  nameHelp: string
  namePlaceholder: string
  templates: string[]
  taskSuggestion: string
}

export const STARTER_PACKS: StarterPack[] = [
  {
    key: 'creator',
    label: 'Content creator or influencer',
    blurb: 'Grow my channel and plan what I post.',
    nameTitle: 'Name your brand',
    nameHelp: 'This is you or your channel. You can rename it later.',
    namePlaceholder: 'Your name or channel',
    templates: ['brand-bible', 'campaign-plan'],
    taskSuggestion: "Plan this week's content",
  },
  {
    key: 'founder',
    label: 'Founder with a personal brand',
    blurb: 'Define what I am known for and show up consistently.',
    nameTitle: 'Name your personal brand',
    nameHelp: 'Usually your own name. You can rename it later.',
    namePlaceholder: 'Your name',
    templates: ['brand-bible', 'campaign-plan'],
    taskSuggestion: 'Write one sentence on what I want to be known for',
  },
  {
    key: 'smm',
    label: 'Social media manager',
    blurb: 'Run content for one or more clients.',
    nameTitle: 'Name your first client',
    nameHelp: 'Add more clients later, each one gets its own space.',
    namePlaceholder: 'Client or brand name',
    templates: ['campaign-plan'],
    taskSuggestion: 'Set up the content calendar',
  },
  {
    key: 'agency',
    label: 'Creative agency',
    blurb: 'Manage brands, campaigns and a team in one place.',
    nameTitle: 'Name your first client',
    nameHelp: 'Add more clients later, each one gets its own space.',
    namePlaceholder: 'Client or brand name',
    templates: ['brand-bible', 'campaign-plan'],
    taskSuggestion: 'Send the discovery link to the client',
  },
  {
    key: 'film',
    label: 'Film or production house',
    blurb: 'Plan shoots and run projects from brief to delivery.',
    nameTitle: 'Name your first client or production',
    nameHelp: 'Add more later, each one gets its own space.',
    namePlaceholder: 'Client or production name',
    templates: ['video-shoot', 'campaign-plan'],
    taskSuggestion: 'Break the script into a shot list',
  },
  {
    key: 'editor',
    label: 'Editing house or editor',
    blurb: 'Keep every edit, review and delivery organized.',
    nameTitle: 'Name your first client',
    nameHelp: 'Add more clients later, each one gets its own space.',
    namePlaceholder: 'Client name',
    templates: ['video-shoot'],
    taskSuggestion: 'Collect the raw footage and references',
  },
  {
    key: 'designer',
    label: 'Graphic designer',
    blurb: 'Build brand identities and keep client work tidy.',
    nameTitle: 'Name your first client or brand',
    nameHelp: 'Add more later, each one gets its own space.',
    namePlaceholder: 'Client or brand name',
    templates: ['brand-bible'],
    taskSuggestion: 'Collect references for the visual identity',
  },
]
