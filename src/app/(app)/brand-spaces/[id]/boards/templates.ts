// Starter templates. Each one arrives with example content so nobody starts from a blank page.
// To add a template, add an entry here — no other code needs to change.

type CardSpec = { type: 'note' | 'heading' | 'color' | 'link' | 'image'; content: string; x: number; y: number }
type BoardSpec = { name: string; cards: CardSpec[] }
export type Template = { name: string; description: string; boards: BoardSpec[] }

const n = (content: string, x: number, y: number): CardSpec => ({ type: 'note', content, x, y })
const h = (content: string, x: number, y: number): CardSpec => ({ type: 'heading', content, x, y })
const c = (hex: string, role: string, use: string, x: number, y: number): CardSpec => ({ type: 'color', content: `${hex}|${role}|${use}`, x, y })

export const TEMPLATES: Record<string, Template> = {
  'brand-bible': {
    name: 'Brand bible',
    description: 'Five boards that define how your brand looks, sounds and who it is for.',
    boards: [
      {
        name: '01 · Visual identity',
        cards: [
          h('Raw. Personal. Warm. Reflective.', 40, 30),
          n('Purpose\nThis board defines how the brand looks and feels. (Example: replace this with your own words.)', 40, 100),
          h('Warm', 40, 250), h('Honest', 270, 250), h('Personal', 500, 250), h('Reflective', 730, 250),
          n('Add 10–15 reference images that feel warm.', 40, 300),
          n('Add references that feel honest.', 270, 300),
          n('Add references that feel personal.', 500, 300),
          n('Add references that feel reflective.', 730, 300),
          h('What we want people to feel', 40, 470),
          n('“This is real.”', 40, 520), n('“I can relate to this.”', 270, 520), n('“I want to follow this journey.”', 500, 520),
        ],
      },
      {
        name: '02 · Color system',
        cards: [
          h('Primary palette', 40, 30),
          c('#ED8D01', 'Primary', 'Main brand color, key moments', 40, 100),
          c('#000000', 'Secondary', 'Supporting color, strong contrast', 200, 100),
          c('#F59A00', 'Accent', 'Small highlights and buttons', 360, 100),
          c('#111111', 'Background', 'Dark backgrounds and title cards', 520, 100),
          c('#FFFFFF', 'Text', 'Captions and headlines on dark', 680, 100),
          n('Color rule\nOne color draws attention. Dark grounds the brand. White keeps it clear. (Example.)', 40, 330),
        ],
      },
      {
        name: '03 · Voice & tone',
        cards: [
          h('How we sound', 40, 30),
          n('We are\nPlain-spoken, warm, honest about the process.', 40, 100),
          n('We are not\nHyped up, salesy, or preachy.', 270, 100),
          n('Words we use\nBuilding, learning, real, step by step.', 500, 100),
          n('Words we avoid\nHustle, guaranteed, secret, overnight.', 730, 100),
          n('Example caption\nDay 12: still figuring it out, and that is the point.', 40, 290),
        ],
      },
      {
        name: '04 · Audience',
        cards: [
          h('Who this is for', 40, 30),
          n('Who they are\nAge, role, where they are in their journey.', 40, 100),
          n('What they struggle with\nThe two or three things that keep them stuck.', 270, 100),
          n('Where they spend time\nPlatforms, communities, creators they follow.', 500, 100),
          n('What they want\nThe outcome they would pay or follow for.', 730, 100),
        ],
      },
      {
        name: '05 · Content pillars',
        cards: [
          h('Pillar 1', 40, 30), h('Pillar 2', 290, 30), h('Pillar 3', 540, 30),
          n('What it is\nWhy it matters to the audience\nFormats: reel, carousel, long video', 40, 80),
          n('What it is\nWhy it matters to the audience\nFormats: reel, carousel, long video', 290, 80),
          n('What it is\nWhy it matters to the audience\nFormats: reel, carousel, long video', 540, 80),
          n('Posting rhythm\nHow often, where, and on which days.', 40, 280),
        ],
      },
    ],
  },
  'video-shoot': {
    name: 'Video shoot plan',
    description: 'Concept, mood, shot list, locations and transitions for one video.',
    boards: [
      {
        name: 'Video shoot plan',
        cards: [
          h('Concept', 40, 30),
          n('The idea in two sentences. What is the story, and what should the viewer feel?', 40, 80),
          h('Mood references', 300, 30),
          n('Drop reference frames here (use the Image tool).', 300, 80),
          h('Rough shot list', 560, 30),
          n('1. Wide opening shot', 560, 80), n('2. Medium, subject working', 560, 160), n('3. Key transition', 560, 240),
          h('Locations', 40, 260),
          n('Where you will shoot, time of day, permits.', 40, 310),
          h('Gear & crew', 300, 260),
          n('Camera, lenses, audio, who is on set.', 300, 310),
          h('Transitions & sound', 40, 450),
          n('Transition ideas, music, sound design notes.', 40, 500),
        ],
      },
    ],
  },
  'campaign-plan': {
    name: 'Campaign plan',
    description: 'Goal, audience, message, channels and content ideas for one campaign.',
    boards: [
      {
        name: 'Campaign plan',
        cards: [
          h('Goal', 40, 30),
          n('One measurable outcome. (Example: 500 new followers in 30 days.)', 40, 80),
          h('Audience', 300, 30),
          n('Who you are talking to and what they care about.', 300, 80),
          h('Core message', 560, 30),
          n('The one sentence you want remembered.', 560, 80),
          h('Channels', 40, 250),
          n('Instagram, TikTok, YouTube, email…', 40, 300),
          h('Content ideas', 300, 250),
          n('Idea 1', 300, 300), n('Idea 2', 300, 380), n('Idea 3', 300, 460),
          h('Timeline', 560, 250),
          n('Week 1: tease\nWeek 2: launch\nWeek 3: proof\nWeek 4: wrap up', 560, 300),
        ],
      },
    ],
  },
  'brand-architecture': {
    name: 'Brand architecture',
    description: 'For founders building one brand together: decide what is shared and what stays personal, platform by platform.',
    boards: [
      {
        name: 'Brand architecture',
        cards: [
          h('The decision', 40, 30),
          n('Shared brand = one name, one look and one voice that both founders stand behind.\nPersonal profiles = each founder\'s own story and voice, built on the shared pillars.', 40, 80),
          h('Three questions', 40, 220),
          n('1. Do people buy from the team, or from each founder? If the team, lead with the shared brand.', 40, 270),
          n('2. Where does each founder\'s audience already live? Keep personal profiles there.', 270, 270),
          n('3. What if one founder leaves? Anything that must stay with the company belongs on the shared brand.', 500, 270),
          h('Platform map (examples, change them)', 40, 420),
          h('Platform', 40, 470), h('Shared brand', 270, 470), h('Founder 1', 500, 470), h('Founder 2', 730, 470),
          n('Instagram', 40, 520), n('Home base: the shared look, launches, behind the scenes', 270, 520), n('Personal story and day-to-day takes', 500, 520), n('Personal story and day-to-day takes', 730, 520),
          n('YouTube', 40, 620), n('Long-form: the main show or flagship content', 270, 620), n('Occasional guest appearance', 500, 620), n('Occasional guest appearance', 730, 620),
          n('LinkedIn', 40, 720), n('Company news and hiring', 270, 720), n('Lead here, in your own voice', 500, 720), n('Lead here, in your own voice', 730, 720),
          n('TikTok', 40, 820), n('Short clips cut from the long-form', 270, 820), n('Optional, only if you enjoy it', 500, 820), n('Optional, only if you enjoy it', 730, 820),
          n('X', 40, 920), n('Announcements only', 270, 920), n('Personal takes and conversations', 500, 920), n('Personal takes and conversations', 730, 920),
          h('Rules we agree on', 40, 1050),
          n('Who posts what, who approves it, how we credit each other, and how often we cross-post.', 40, 1100),
        ],
      },
    ],
  },
  'founder-profile': {
    name: 'Founder profile',
    description: 'One founder\'s story, voice and platforms, built on top of the shared brand.',
    boards: [
      {
        name: 'Founder profile',
        cards: [
          h('My story', 40, 30),
          n('Why I started, what I have been through, and the moment that shaped how I work.', 40, 80),
          h('What I am known for', 300, 30),
          n('The one thing people should say about me when I am not in the room.', 300, 80),
          h('How my voice differs', 560, 30),
          n('Where I sound different from the shared brand: more direct, more personal, more playful?', 560, 80),
          h('My platforms', 40, 260),
          n('Where I show up as myself, and how often.', 40, 310),
          h('Three content angles', 300, 260),
          n('Angle 1', 300, 310), n('Angle 2', 300, 390), n('Angle 3', 300, 470),
          h('What I will not talk about', 560, 260),
          n('Topics, people and opinions I keep off the record.', 560, 310),
          h('How I support the shared brand', 40, 460),
          n('When I share the brand\'s posts, when I stay quiet, and how I mention my co-founder.', 40, 510),
        ],
      },
    ],
  },
}

export const TEMPLATE_LIST = Object.entries(TEMPLATES).map(([key, t]) => ({
  key,
  name: t.name,
  description: t.description,
  boardCount: t.boards.length,
  boardNames: t.boards.map((b) => b.name),
}))
