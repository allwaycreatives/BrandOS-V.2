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

## Next (reviews)
- WhatsApp notifications, a per-person switch for email, and notifications for invites and approvals on campaign content
- Image/design proofs with pins on the image; timestamped comments that jump the video
- Brief intake link that creates a project
- Client-facing white-label (agency logo and colors on share and review pages): likely a paid-plan feature
- Retainer packages / quotas
