# Brand OS

**Brand OS is a brand operating system for creatives.** It helps you discover your brand, manage it, and grow it, with one or many brands, and all their projects and tasks, in one simple place.

**Who it is for:** anyone in the creative space: content creators, influencers, content and marketing agencies, film and production houses, editing houses, graphic designers, web developers.

**How it works:** you can start with discovery questions to find out what a brand really is, or skip them and create a brand straight away. From there you keep track of the work: projects, tasks, campaigns, content calendars, boards, client reviews, and a short brief form you can send to a client so you know what they want before you start.

**The principle that decides everything we build: keep it simple.** A simple-minded content creator should be able to use it over and over without it ever becoming complicated. ("Duplicatable" means exactly that: easy to pick up and repeat. It is a mindset, not a Duplicate button.) If an idea makes Brand OS harder to explain in three sentences, it does not belong here.

---

## Technical notes (original starter)

This is the first real code, matching `Technical-Architecture-MVP.md`:
- Next.js (App Router) + TypeScript
- Prisma schema covering the MVP data model (organizations, brand spaces, discovery, brand kit, calendar)
- Dashboard page (brand space roster)
- Public no-login discovery form page (`/discovery/[token]`)

The dashboard works out of the box with placeholder data even without a database connected, so you can see it running immediately.

## Run it locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Connect a real database (when you're ready)

1. Get a free Postgres instance (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com)) or run one locally.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`.
3. Run:
   ```bash
   npm run prisma:migrate
   ```
4. Restart `npm run dev` — the dashboard will now read real data instead of placeholders.

## Push this to your own GitHub repo

1. Create a new empty repository on GitHub (no README/license — just an empty repo).
2. In this project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial BrandOS scaffold"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

## What's next (see Technical-Architecture-MVP.md Section 4)

- Sprint 1: wire up real auth (Clerk/Auth0/Supabase Auth) and brand space creation
- Sprint 2: build the discovery template editor and connect `/discovery/[token]` to real submissions
- Sprint 3: AI bio/tagline generation via the Anthropic API
- Sprint 4+: calendar, boards, collaboration

## Project structure

```
src/
  app/
    page.tsx                    landing page
    dashboard/page.tsx          brand space roster
    discovery/[token]/page.tsx  public client-facing discovery form
  lib/db.ts                     Prisma client
prisma/schema.prisma            full MVP data model
-
```


<!-- redeploy trigger: fresh build after Clerk key fix -->
