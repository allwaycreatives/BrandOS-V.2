# Brand OS — Roadmap

**Vision:** one simple place for creatives (creators, agencies, editors, designers,
social media managers) to discover their brand and run projects and campaigns from
idea to posting. It must be **simple**, **duplicatable** and **shareable**.

## Done
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
- Guided first-run: "create your first brand" instead of an empty dashboard
- Duplicate a brand space / campaign in one click
- Starter packs by role (influencer, editor, designer, agency)
- Read-only shareable brand page (works as a brand guide for clients)
- Later: public template gallery

## Needs a developer
- Replace `prisma db push` with proper migrations (needs direct database access)
- Revoke/manage invite links from the UI
- Plans and paid packages (billing)
- Overall look, feel and onboarding flow — the current build "isn't there yet"
