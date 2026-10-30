import type { Strategy } from './strategy'
import { IMPORT_PLATFORMS } from './importFormat'

// The text a person pastes into ChatGPT ONCE (project instructions, custom instructions, or a first message).
// It describes the layout only. ChatGPT already knows the brand; this just teaches it how to hand the work to Brand Console.
export function postFormatSheet(strategy: Strategy | null): string {
  const names = strategy
    ? [
        strategy.pillars.length ? `My pillars: ${strategy.pillars.map((p) => p.name).join('; ')}` : '',
        strategy.series.length ? `My series: ${strategy.series.map((s) => s.name).join('; ')}` : '',
        strategy.platforms.length ? `My platforms: ${strategy.platforms.map((p) => p.name).join('; ')}` : '',
      ].filter(Boolean)
    : []

  return `BRAND CONSOLE FORMAT (for content posts)

When I ask for posts "in Brand Console format", answer with ONLY the posts. Nothing before them and nothing after. One block per post, laid out exactly like this:

## Post title
Platform: Instagram
Format: Short video
Pillar: (one of my pillars)
Series: (one of my series, or leave empty)
Priority: High, Normal or Low
Publish: 2026-11-04
Production: 2026-11-01
Hook: (the hook you recommend)
Hook options:
- (option 1)
- (option 2)
- (option 3)
CTA: (what the viewer should do next)
Objective: (what this piece is for, and who it is for)
Main message: (the one thing it must communicate)
Caption: (the caption, ready to post)
Success metric: (how we will know it worked)
Notes: (anything the team should know)
Brief:
(the script, outline or draft, as plain text)

Rules:
- Start every post with "## " and the title. Use "##" only for post titles.
- Inside the Brief, never use # headings. Use plain lines or bold text instead.
- Dates are always written like 2026-11-04 (year-month-day). Leave a date empty if you do not know it.
- Format is one of: Short video, Long video, Carousel, Image post, Text post, Story, Live, Article.
- Platform is one of: ${IMPORT_PLATFORMS.join(', ')}.
- Use my exact pillar and series names. Leave a field empty rather than inventing something.
- Adapt the Brief to the format: a text post needs a draft, not a filming plan.
${names.length ? '\n' + names.join('\n') + '\n' : ''}`
}

export function strategyFormatSheet(): string {
  return `BRAND CONSOLE FORMAT (for a content strategy)

When I ask for a content strategy "in Brand Console format", answer with ONLY this, laid out exactly like this:

Mission: (one or two sentences)
Season: (the name of the current season or chapter)
Season story: (a short paragraph)
Pillars:
- Pillar name | core | one line on what it covers
- Pillar name | one line on what it covers
Platforms:
- Instagram | primary | 3 per week | the platform's angle in one line
- YouTube | secondary | 2 per month | the platform's angle in one line
Series:
- Series name | Pillar it belongs to | what a post in this series is

Rules:
- Write "core" only for the main pillar or pillars. Leave it out for supporting ones.
- Platform role is primary, secondary or supporting.
- Platform is one of: ${IMPORT_PLATFORMS.join(', ')}.
- Write targets as "3 per week" or "2 per month".
- Use only what I have told you. Leave a section out rather than inventing it.`
}
