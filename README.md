# Dashboard

A role-based all-in-one dashboard (working name; change it in `src/lib/site.ts`).
Pick your profession and get a ready-made workspace: tasks, projects, clients, meetings,
money and a feed of matched leads and jobs.

This repo holds both the public marketing site and the signed-in app.

## Stack

- Next.js 16 (App Router, Turbopack, Cache Components, Proxy) + TypeScript
- Tailwind CSS v4 with 4 themes (Midnight, Daylight, Forest, Dusk) via `data-theme`
- Supabase: Postgres, Auth (Google + email link), row-level security
- zod for validating every form and every template
- Self-hosted fonts (Space Grotesk, Inter, JetBrains Mono)

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: fill in Supabase values
npm run dev                  # http://localhost:3000
```

**Demo mode:** without Supabase values, `/login` shows "Try the demo". Everything works:
your profile is kept in a cookie, and clients/projects/tasks live in server memory for your
demo session (seeded with examples; restarting the server resets them).

## Supabase setup (real accounts)

1. Create a project at supabase.com.
2. **SQL Editor:** run the files in `supabase/migrations/` in order (`0001` → `0005`).
3. **Settings → API:** copy the Project URL and anon public key into `.env.local`.
4. **Authentication → URL Configuration:** set Site URL to your domain and add
   `http://localhost:3000/auth/callback` and `https://your-domain.com/auth/callback` to Redirect URLs.
5. **Authentication → Providers → Google:** enable it with a Google Cloud OAuth client
   (authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`).
6. Email sign-in links work out of the box (Supabase's built-in mailer is rate-limited; add SMTP for production).

## How it fits together

| Area | Where |
| --- | --- |
| Marketing site (home, `/for/[role]`, privacy) | `src/app/(marketing)/` |
| Waitlist action (validation, honeypot, rate limit) | `src/app/actions.ts` |
| Login page (Google, email link, demo) | `src/app/login/page.tsx` |
| Auth + profile actions | `src/app/auth-actions.ts` |
| OAuth / email-link callback | `src/app/auth/callback/route.ts` |
| Session refresh + route gate | `src/proxy.ts` |
| Data access layer (the only place that reads session/profile) | `src/lib/auth.ts` |
| Profile schema and DB mapping | `src/lib/profile.ts` |
| Onboarding (4-step wizard, reused in Settings) | `src/app/onboarding/`, `src/components/onboarding/ProfileWizard.tsx` |
| **Template engine** | `src/templates/` |
| App shell + sidebar | `src/app/app/layout.tsx`, `src/components/app/Sidebar.tsx` |
| Home widgets + widget registry | `src/components/widgets/Widgets.tsx` |
| Module routing (real views or "coming next") | `src/app/app/[module]/page.tsx` |
| Clients, Projects (board + list), Tasks screens | `src/components/app/views/` |
| Create / edit / delete actions | `src/app/app/work-actions.ts` |
| Finance (month view, chart, categories) and invoices (builder, print/PDF) | `src/components/app/views/FinanceView.tsx`, `InvoicesView.tsx`, `src/app/app/invoice/[id]/` |
| Finance actions (paying an invoice records the income) | `src/app/app/finance-actions.ts` |
| Storage interface + Supabase and demo implementations | `src/lib/data/` |
| **Opportunity engine** (sources, parsing, skills, scoring, feed) | `src/lib/opportunities/` |
| Scheduled collector endpoint | `src/app/api/cron/collect/route.ts`, `vercel.json` |
| Opportunities feed + pipeline | `src/components/app/views/OpportunitiesView.tsx`, `src/app/app/opportunity-actions.ts` |
| Unit tests (`npm test`) | `tests/` |
| Database migrations | `supabase/migrations/` |

### Templates

Each profession is one config file validated with zod at startup (`src/templates/types.ts`):
modules and their labels, vocabulary ("Client" vs "Student"), home widgets and their sizes,
onboarding questions, opportunity sources, and default automations.

To add a profession: copy `software-engineer.ts`, change it, and register it in `src/templates/index.ts`.
To add a widget type: add it to `WIDGET_TYPES` and to the registry in `Widgets.tsx`.

### Security

- Proxy refreshes the session and blocks `/app` and `/onboarding` for signed-out users;
  the server re-checks with `supabase.auth.getUser()` in `src/lib/auth.ts`.
- Row-level security: users can only read and write their own profile, clients, projects and tasks;
  a trigger blocks linking to another account's client or project; the waitlist is insert-only.
- All input is parsed with zod on the server; redirects only go to `/app/*`.
- Login is rate-limited and doesn't reveal whether an email has an account.
- CSP, HSTS, frame, referrer and permissions headers in `next.config.ts`.

## Status

Done: landing site, waitlist, auth, onboarding, template engine (4 templates), app shell,
settings with live template switching, and real **Clients**, **Projects** (Kanban + list) and
**Tasks** (overdue / today / upcoming), **Finance** (income, expenses, categories, 6-month chart)
and **Invoices** (line items, draft → sent → paid, print / save as PDF). Marking an invoice paid
records the income automatically; undoing it removes that entry. Home KPIs, Today, Money and
Active projects use real data.

The **opportunity engine** is live: scheduled collectors, de-duplication, explainable matching,
a filterable feed and a pipeline (demo mode uses an example feed from fictional companies).

Next: Google Calendar sync; automation rules UI and the daily email digest; AI-drafted proposals.

### Opportunity engine

1. **Collect.** Every 6 hours `/api/cron/collect` pulls public feeds: Remotive, Remote OK,
   Arbeitnow, and any company career pages you list in `GREENHOUSE_BOARDS` / `LEVER_SITES`.
   Each source has a pure parser in `sources/parsers.ts` (unit-tested). Failures are isolated per source.
2. **Normalise.** HTML is stripped to plain text (never rendered), links must be http(s),
   skills are read from titles, tags and descriptions using a skill dictionary.
3. **De-duplicate.** The same role on several boards shares a fingerprint (company + title);
   the company's own career page wins.
4. **Store.** Postings go into the shared `opportunities` table with the service-role key.
   Users can only read it; their own statuses live in `user_opportunities` (owner-only).
   Postings older than 45 days that nobody kept are removed.
5. **Match.** Each user's feed is scored on the fly (0–100) from skill overlap, title, remote
   preference, work type and freshness, with plain-English reasons and cautions.
   Close skills count too (Flutter → Dart, Jetpack Compose → Kotlin/Android).
6. **Act.** Save, mark applied/contacted, dismiss; the pipeline runs Saved → Contacted →
   Proposal → Won/Lost. Marking a lead "contacted" creates a follow-up task in 3 days.

**Source rules we follow:** Remotive and Remote OK require crediting them with a link to the
original posting (every card shows "via …" with that link); Remotive asks for at most ~4 fetches a
day, hence the 6-hour schedule. No logged-in scraping of LinkedIn, Upwork or similar.
Check each source's current terms before launch, and check your Vercel plan's cron frequency limits.

Run the collector by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron/collect`

## Deploy

Vercel: import the repo, add the env vars from `.env.example`, deploy.
Any Node host works with `npm run build && npm start`.
