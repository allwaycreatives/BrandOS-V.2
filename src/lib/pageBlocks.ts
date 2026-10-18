// The block format behind Documents ("pages"). It is saved as plain text, one block per line, so old plain-text
// documents still open (every line is just a paragraph) and nothing in the database has to change:
//
//   Title line
//   @icon:📄            (optional, first line after the title)
//   # Heading 1   ## Heading 2   ### Heading 3
//   - bullet   1. numbered   [ ] to-do   [x] done to-do
//   > quote   !> callout   ---   ![](image-url)
//   anything else is a paragraph

export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'todo' | 'quote' | 'callout' | 'divider' | 'image'
export type Block = { id: string; type: BlockType; text: string; done: boolean }

let counter = 0
export const newBlock = (type: BlockType = 'p', text = '', done = false): Block => ({ id: `b${++counter}`, type, text, done })

const SOFT_BREAK = '\u2028' // a line break inside one block, so every block still fits on a single saved line
const ESCAPE = '\u200B' // keeps a paragraph that looks like a marker from turning into a list when it is read back
const encode = (t: string) => t.replace(/\r?\n/g, SOFT_BREAK)
const decode = (t: string) => t.split(SOFT_BREAK).join('\n')

export function parseLine(line: string): Block {
  if (line === '---') return newBlock('divider')
  let m: RegExpExecArray | null
  if ((m = /^(#{1,3}) (.*)$/.exec(line))) return newBlock(`h${m[1].length}` as BlockType, decode(m[2]))
  if ((m = /^[-*] (.*)$/.exec(line))) return newBlock('bullet', decode(m[1]))
  if ((m = /^\d+\. (.*)$/.exec(line))) return newBlock('number', decode(m[1]))
  if ((m = /^\[( |x)\] ?(.*)$/.exec(line))) return newBlock('todo', decode(m[2]), m[1] === 'x')
  if ((m = /^!> (.*)$/.exec(line))) return newBlock('callout', decode(m[1]))
  if ((m = /^> (.*)$/.exec(line))) return newBlock('quote', decode(m[1]))
  if ((m = /^!\[[^\]]*\]\((.+)\)$/.exec(line))) return newBlock('image', m[1])
  return newBlock('p', decode(line.startsWith(ESCAPE) ? line.slice(1) : line))
}

export function serializeBlock(b: Block): string {
  const t = encode(b.text)
  switch (b.type) {
    case 'h1': return `# ${t}`
    case 'h2': return `## ${t}`
    case 'h3': return `### ${t}`
    case 'bullet': return `- ${t}`
    case 'number': return `1. ${t}`
    case 'todo': return `[${b.done ? 'x' : ' '}] ${t}`
    case 'quote': return `> ${t}`
    case 'callout': return `!> ${t}`
    case 'divider': return '---'
    case 'image': return `![](${b.text})`
    default: return (parseLine(t).type !== 'p' ? ESCAPE : '') + t
  }
}

export function parseBlocks(body: string): { icon: string; blocks: Block[] } {
  const lines = body.split('\n')
  let icon = ''
  if (lines[0]?.startsWith('@icon:')) icon = (lines.shift() as string).slice(6).trim()
  const blocks = lines.map(parseLine)
  return { icon, blocks: blocks.length ? blocks : [newBlock()] }
}

export const serializeBlocks = (icon: string, blocks: Block[]) => (icon ? `@icon:${icon.replace(/\s/g, '')}\n` : '') + blocks.map(serializeBlock).join('\n')

// A document is its title (first line) and then the page.
export function splitDocument(content: string) {
  const i = content.indexOf('\n')
  return i < 0 ? { title: content, body: '' } : { title: content.slice(0, i), body: content.slice(i + 1) }
}
export const joinDocument = (title: string, body: string) => `${title.replace(/\n/g, ' ')}\n${body}`

// Typing "# " or "- " at the start of a plain paragraph turns it into that kind of block, like Notion.
export function shortcutFor(value: string): { type: BlockType; text: string; done?: boolean } | null {
  let m: RegExpExecArray | null
  if (value === '---') return { type: 'divider', text: '' }
  if ((m = /^(#{1,3}) /.exec(value))) return { type: `h${m[1].length}` as BlockType, text: value.slice(m[0].length) }
  if ((m = /^[-*] /.exec(value))) return { type: 'bullet', text: value.slice(m[0].length) }
  if ((m = /^\d+\. /.exec(value))) return { type: 'number', text: value.slice(m[0].length) }
  if ((m = /^\[( ?|x)\] /.exec(value))) return { type: 'todo', text: value.slice(m[0].length), done: m[1] === 'x' }
  if ((m = /^> /.exec(value))) return { type: 'quote', text: value.slice(m[0].length) }
  return null
}

// Pasting several lines (for example Markdown from somewhere else) becomes several blocks.
export function parsePasted(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((l) => parseLine(l.replace(/^\s+/, '')))
}

// Numbered items count up within an unbroken run: 1, 2, 3, then start again after anything else.
export function numberingOf(blocks: Block[]): number[] {
  let n = 0
  return blocks.map((b) => (b.type === 'number' ? ++n : ((n = 0), 0)))
}

export type SlashItem = { type: BlockType; label: string; hint: string; words: string }
export const SLASH_ITEMS: SlashItem[] = [
  { type: 'p', label: 'Text', hint: 'Plain writing', words: 'text paragraph plain' },
  { type: 'h1', label: 'Heading 1', hint: 'Big section title', words: 'heading h1 title big' },
  { type: 'h2', label: 'Heading 2', hint: 'Medium section title', words: 'heading h2 subtitle' },
  { type: 'h3', label: 'Heading 3', hint: 'Small section title', words: 'heading h3 small' },
  { type: 'bullet', label: 'Bulleted list', hint: 'A simple list', words: 'bullet list unordered' },
  { type: 'number', label: 'Numbered list', hint: 'A list with numbers', words: 'number numbered list ordered' },
  { type: 'todo', label: 'To-do list', hint: 'Tasks you can tick off', words: 'todo to-do task check checklist' },
  { type: 'quote', label: 'Quote', hint: 'Call out a quote', words: 'quote' },
  { type: 'callout', label: 'Callout', hint: 'Make a note stand out', words: 'callout note highlight tip' },
  { type: 'divider', label: 'Divider', hint: 'A line between sections', words: 'divider line separator hr' },
  { type: 'image', label: 'Image', hint: 'Upload a picture', words: 'image picture photo upload' },
]
export const filterSlash = (query: string) => {
  const q = query.trim().toLowerCase()
  return q ? SLASH_ITEMS.filter((i) => i.label.toLowerCase().includes(q) || i.words.includes(q)) : SLASH_ITEMS
}
