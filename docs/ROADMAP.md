# Brand OS — Roadmap

**Vision:** one simple place for anyone in the creative space (film and production houses,
editing houses, creative agencies, social media managers, content creators, influencers,
designers, and founders with personal brands) to discover their brand, then plan and run
projects, campaigns and tasks from idea to delivery. It must be **simple**, **duplicatable**
(reusable over and over) and **shareable**.

## Done
- Sidebar by type of work + new Home; My tasks across all brands
- Milanote-style boards: tool rail, paper cards, templates with example content, duplicate, read-only share link
- Campaigns: 5-stage content pipeline (idea to published), tasks, duplicate
- Projects: brief / in progress / in review / delivered, tasks and boards, duplicate
- Duplicate a whole brand (boards, discovery questions, campaigns as a fresh plan)
- Reviews: send a link, client comments / requests changes / approves with no account (WhatsApp-friendly), version history, "what this client wants" memory built from all feedback
- Updates bell: owners and team members are notified when a client comments, requests changes or approves (email too once RESEND_API_KEY and EMAIL_FROM are set)
- Share → copy loop: anyone with a board's share link can copy it into their own workspace (sign-up first if new). Images stay linked to the original files.
- Your own templates: save any board, campaign or project once, use it for any brand in the workspace (Templates page)
- Brief intake: a public form link per brand; a client's brief becomes a project in Brief stage with the brief attached, a first task and a notification
- Pinned comments on image proofs: clients click the exact spot, pins are numbered and match the thread; teams can upload image proofs (up to 15 MB) or paste a link
- Sidebar grouped into Brand / Work / Clients under the open brand; Tasks form tucked into 'More options'
- Light and dark mode (toggle in the top bar and on client pages, remembered per device, dark by default); thin, quiet scrollbars; logo glow removed
- Clients' home lists what is waiting for their feedback, one tap from the review page
- Founder brands: founder setup (one shared brand + a personal brand per founder, linked), Brand architecture and Founder profile templates, link existing brands into a family, founders shown under the shared brand
- Family view: posting map (planned/published content per platform per brand) and a combined content pipeline; founders start from the shared brand's identity until they have their own discovery
- Company-first founder setup: the company brand leads and founders are its "faces" (name, optional role). Each face can get a personal brand later with one button ("Start their personal brand", Founder profile board included). Setup offers company-first (default) or company + personal brands now
- Delete brand (owner only): type the brand's name to confirm, see exactly what will be deleted, removed in one all-or-nothing step. Personal brands under a deleted company stay, unlinked. Uploaded files stay in storage
- Ideas: park an idea fast, promote it to a campaign or project
- Shareable read-only brand guide link (positioning, voice, audience, platform kit)
- First-run guide with starter packs by role (creator, founder, social media manager, agency, film house, editor, designer)
- Invite links fixed and made secure (role is set on the server, links can be revoked later)
- Upload endpoint requires sign-in, with file type and size limits
- Build no longer runs `--accept-data-loss`

## Roles and permissions — first version done
- Owner manages everything, including a new People & permissions page per brand
- Team members can create and edit, but can invite others only if the owner switches "Can invite" on for them
- Clients view and approve only; they never see campaigns or projects
- Owner can switch a person between client and team member, remove them, and switch off invite links
- Still open: more per-person toggles (delete things, see all brands vs only assigned ones), team roles across a whole workspace instead of per brand, an "owner" that can be shared by more than one person

## Next: Make it simple, duplicatable, shareable
- Share a campaign or project (read-only link), client approval on campaign content
- Share your templates with other workspaces / a public template gallery
- Copy-from-share for campaigns and projects (boards done)
- Per-role wording throughout (client vs brand vs channel)

## Needs a developer
- Replace `prisma db push` with proper migrations (needs direct database access)
- Plans and paid packages (billing)
- Overall look, feel and onboarding flow — the current build "isn't there yet"

## Decisions: what we deliberately do NOT build
- Task discovery (too small to need it; discovery is for brands, campaigns, client briefs)
- Hosting raw footage or large files — we store links (Drive, Frame.io, YouTube, Dropbox). Existing task file uploads are a cost risk to review with a developer.
- Posting/scheduling to social platforms (integrations break; planning only)
- Chat/inbox, time tracking, invoicing, Gantt charts (until customers ask)
- Per-industry versions of the product (one product, starter packs instead)
- Notion embed (removed). The database column is kept so no data is dropped; remove it in a proper migration.

## Next (brand families)
- Duplicating a company brand does not copy its faces yet
- Family-wide campaigns (one campaign that spans the shared brand and founders); guidance when a founder doubles up on a platform the shared brand covers

## Next (reviews)
- WhatsApp notifications, a per-person switch for email, and notifications for invites and approvals on campaign content
- Timestamped comments that jump the video; pins on PDFs; a before/after view across versions
- Brief intake: custom questions per brand, file links, moving a brief from an 'inquiries' brand into a real client brand
- Client-facing white-label (agency logo and colors on share and review pages): likely a paid-plan feature
- Retainer packages / quotas

## Theme notes for the developer
- Colors are CSS variables in `src/app/globals.css` (`:root` for dark, `:root[data-theme="light"]` for light). Use `--accent` for fills and `--accent-text` for accent-coloured text (it is darker in light mode so it stays readable).
- Clerk's own pop-ups (avatar menu, sign-in pages) do not follow the theme yet; they need Clerk's `appearance` setting.
- Board paper cards stay white in both themes on purpose.
- Default is dark; to follow the device setting instead, change THEME_SCRIPT in `src/app/layout.tsx`.
