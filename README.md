# Dashboard — landing page + waitlist

Phase 0 of Dashboard (working name; change it in `src/lib/site.ts`): a fast, SEO/AEO/GEO-ready marketing site with a
waitlist backed by Supabase. The dashboard app comes next in this same repo.

## Stack

- Next.js 16 (App Router, Turbopack, Cache Components) + TypeScript
- Tailwind CSS v4 with 4 themes (Midnight, Daylight, Forest, Dusk) via `data-theme`
- Supabase (Postgres) for the waitlist, insert-only through row-level security
- Self-hosted fonts (Space Grotesk, Inter, JetBrains Mono) — no external font requests

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev                  # http://localhost:3000
```

Without Supabase values the form still works in "dev mode" and simply doesn't save.

## Supabase setup

1. Create a project at supabase.com.
2. Open **SQL Editor** and run `supabase/migrations/0001_waitlist.sql`.
3. Copy **Project URL** and **anon public key** (Settings → API) into `.env.local`.
4. View signups in **Table Editor → waitlist** (only you can read them; the public key can only insert).

## What's included

| Area | Where |
| --- | --- |
| Home page (hero, features, how it works, templates, themes, security, FAQ, CTA) | `src/app/page.tsx` |
| Profession landing pages (`/for/software-engineers`, …) | `src/app/for/[role]/page.tsx` |
| Waitlist server action (zod validation, honeypot, rate limit) | `src/app/actions.ts` |
| Site copy, roles and FAQ (edit text here) | `src/lib/site.ts` |
| Themes and motion | `src/app/globals.css`, `src/lib/themes.ts` |
| SEO: metadata, canonical, Open Graph image, sitemap, robots | `layout.tsx`, `opengraph-image.tsx`, `sitemap.ts`, `robots.ts` |
| AEO: FAQPage, SoftwareApplication, Organization, Breadcrumb JSON-LD | `page.tsx`, `layout.tsx`, `for/[role]` |
| GEO: `/llms.txt` summary for AI assistants | `src/app/llms.txt/route.ts` |
| Security headers (CSP, HSTS, frame, referrer, permissions) | `next.config.ts` |
| Privacy page (draft) | `src/app/privacy/page.tsx` |

## Before going live

- Set `NEXT_PUBLIC_SITE_URL` to the real domain (used in canonical URLs, sitemap, JSON-LD).
- Replace the placeholder name and contact email in `src/lib/site.ts` once decided.
- The rate limiter is in-memory (fine for one server). On serverless, swap in Upstash Redis.
- Have the privacy page reviewed before collecting account data.
- Submit the sitemap in Google Search Console and Bing Webmaster Tools.

## Deploy

Vercel: import the repo, add the three env vars, deploy. Any Node host works with
`npm run build && npm start`.
