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
- First-run guide with starter packs by role (creator, founder, social media manager, agency, film house, editor, designer)
- Invite links fixed and made secure (role is set on the server, links can be revoked later)
- Upload endpoint requires sign-in, with file type and size limits
- Build no longer runs `--accept-data-loss`

## Next: Roles and permissions (agency / team use)
Who can do what, inside a workspace:
- **Admin / owner** — full control. Is the only one who can invite people by default.
- **Team member** — can create and edit content, tasks, campaigns. **Cannot invite others by default.**
- **Optional per-person permission:** admin can switch on "can invite people" for a specific team member.
- **Client** — view, comment and approve only.
- Open questions: what else should be toggleable per person (delete things? manage billing? see all client brands or only assigned ones)? Should team members be assigned to specific brands?
- Build notes: today only the workspace owner can create invites (see `createInvite` in
  `src/app/(app)/brand-spaces/[id]/inviteActions.ts`). A "can invite" flag would live on
  the member's access record.

## Next: Make it simple, duplicatable, shareable
- Read-only shareable brand page (works as a brand guide for clients)
- Share a campaign or project (read-only link), client approval on campaign content
- Save your own board/campaign/project as a reusable template; later a public template gallery
- Ideas: a place to park ideas and promote them to a campaign or project
- Per-role wording throughout (client vs brand vs channel)

## Needs a developer
- Replace `prisma db push` with proper migrations (needs direct database access)
- Revoke/manage invite links from the UI
- Plans and paid packages (billing)
- Overall look, feel and onboarding flow — the current build "isn't there yet"
