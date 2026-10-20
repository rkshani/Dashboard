# Dashboard: Go-Live Guide

Everything left to do before the public beta, in order.
Each step is marked **[You]** (needs your accounts or a decision) or **[AI]** (a code task an AI coding assistant in VS Code can do in this repo).

- **Repo:** `rkshani/Dashboard` (branch `main`)
- **Stack:** Next.js 16 (App Router, `cacheComponents`), Tailwind v4, Supabase (Postgres + Auth + row-level security), Vercel (hosting and cron)
- **State:** all features are built. The code is tested with 53 unit tests and database tests (`npm run test:db`). Pro is free during beta, so billing isn't needed yet.

---

## For the AI assistant in VS Code: read this first

- Read `AGENTS.md`. This is Next.js 16, so check `node_modules/next/dist/docs` before using any Next API.
- Rules already used in this codebase:
  - read cookies and searchParams only inside `<Suspense>`;
  - never call `new Date()` during prerender;
  - every server action re-checks the session through `getRepo()` and validates input with zod;
  - every Supabase query filters by `owner_id`.
- Data goes through the `Repo` interface (`src/lib/data/repo.ts`), which has two implementations: Supabase and an in-memory demo.
- Database changes go in a **new** numbered file in `supabase/migrations/`. Never edit a migration that has already been applied in production.
- After any change, run `npm run lint`, `npm test`, `npm run build`, and `npm run test:db` if SQL changed.
- Commit as `Shayan Gul <rkknight.47@gmail.com>`.

---

## Phase 1: Accounts and keys [You]

### 1.1 Supabase
1. Create a project at supabase.com. Pick the region closest to your users.
2. In the **SQL Editor**, run every file in `supabase/migrations/` in order, `0001` → `0012`.
   - If some were run earlier, still run `0012`: it fixes database triggers that blocked saving projects, tasks and invoices.
3. Go to **Authentication → URL Configuration**:
   - set Site URL to `https://YOUR-DOMAIN`;
   - add the redirect URL `https://YOUR-DOMAIN/auth/callback`.
4. Go to **Authentication → Providers**:
   - turn on Email (magic link);
   - turn on Google, using the client from step 1.4.
5. Copy these keys from Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`;
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
   - `SUPABASE_SERVICE_ROLE_KEY` (server only, never expose it).

### 1.2 Domain and Vercel
1. Buy a domain. Import the GitHub repo into Vercel and attach the domain.
2. **Plan:** check Vercel's current pricing page. As far as we know, the Hobby plan is for non-commercial use and runs cron jobs at most once a day. This app needs:
   - `/api/cron/automations` **every hour**;
   - `/api/cron/collect` every 6 hours.

   So use **Vercel Pro**, or keep Hobby and call both URLs from an external scheduler (for example cron-job.org) with the header `Authorization: Bearer <CRON_SECRET>`.
3. Add every variable from section 1.7 in **Settings → Environment Variables**, for Production.

### 1.3 Upstash Redis (shared rate limiting)
- Create a free Redis database at upstash.com.
- Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 1.4 Google (sign-in and Calendar)
1. In Google Cloud Console, create a project. Set up the **OAuth consent screen** with your app name, logo, the privacy and terms URLs, and your support email.
2. Create an OAuth client (Web application) with these authorised redirect URIs:
   - `https://YOUR-DOMAIN/api/integrations/google/callback` (Calendar);
   - the Supabase Google callback shown in Supabase → Auth → Providers → Google (sign-in).
3. Enable the **Google Calendar API**.
4. The scope `calendar.events` is **sensitive**, so submit the app for **Google verification**. It takes days to weeks. Until it is approved, users see an "unverified app" warning and you are limited to 100 test users.
5. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 1.5 Resend (emails: digest, invoices)
1. Add and **verify your domain** with the SPF and DKIM DNS records. Without this, emails land in spam.
2. Copy `RESEND_API_KEY` and set `DIGEST_FROM_EMAIL`, for example `Dashboard <digest@YOUR-DOMAIN>`.

### 1.6 Optional services
- **AI proposal drafts:** set `ANTHROPIC_API_KEY` from console.anthropic.com. The model defaults to `claude-haiku-5-5`. Without a key, drafts come from a template.
- **Push notifications:** run `npx web-push generate-vapid-keys` and set the VAPID variables in section 1.7.
- **Error alerts:** a Slack or Discord incoming webhook goes in `ALERT_WEBHOOK_URL`.
- **More job sources:** `GREENHOUSE_BOARDS` and `LEVER_SITES` (see `.env.example`).

### 1.7 All environment variables

| Variable | Required | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://YOUR-DOMAIN` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Yes | Your support email |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase → Settings → API (secret) |
| `CRON_SECRET` | Yes | `openssl rand -hex 24` |
| `TOKEN_ENCRYPTION_KEY` | Yes | `openssl rand -base64 32`. **Never change it later**, or connected Google accounts stop working. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | For Calendar | Google Cloud |
| `RESEND_API_KEY` / `DIGEST_FROM_EMAIL` | For emails | Resend |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | For push | `npx web-push generate-vapid-keys`; `VAPID_SUBJECT` is a `mailto:` address |
| `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) | For AI drafts | console.anthropic.com |
| `ALERT_WEBHOOK_URL` | Recommended | Slack or Discord webhook |
| `ALLOW_PUBLIC_DEMO` | **Leave unset** | Demo mode is for local development only |

> `NEXT_PUBLIC_*` values are built into the browser code. Redeploy after changing them.

---

## Phase 2: Code tasks before launch [AI]

### 2.1 Rewrite the privacy policy — `src/app/(marketing)/privacy/page.tsx`
The page still describes the waitlist only. Rewrite it for the real app:
- **What we store:**
  - account email and profile (field, skills, rate, currency, timezone, theme);
  - clients, projects, tasks, transactions, invoices, students, attendance, content posts, notifications and proposal drafts.
- **Third parties (processors):**
  - Supabase (database and auth);
  - Vercel (hosting);
  - Google (sign-in, plus Calendar if connected);
  - Resend (email);
  - Anthropic (only the posting text and profile facts, when the user clicks "Draft it");
  - browser push services (Google, Apple, Mozilla);
  - ExchangeRate-API (no personal data sent);
  - Upstash (rate-limit counters keyed by user id or IP, deleted automatically).
- **Public job data:** job postings come from public job boards (Remotive, RemoteOK, Arbeitnow, Greenhouse, Lever), each with its source credited.
- **Google API data:** add Google's required statement: "use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements". Say that Calendar tokens are encrypted at rest.
- **Retention and deletion:**
  - Settings → Export my data (JSON);
  - Settings → Delete account (removes everything);
  - notifications are deleted after 90 days.
- **Contact:** use `NEXT_PUBLIC_CONTACT_EMAIL`.
- Keep the existing page style. Run `npm run build` afterwards.

### 2.2 Review the terms — `src/app/(marketing)/terms/page.tsx`
Check that it mentions:
- the free beta (Pro is free, and features may change);
- that AI drafts must be reviewed before sending;
- that job listings belong to third parties.

### 2.3 Install as an app (PWA manifest)
- Add `src/app/manifest.ts` with:
  - name "Dashboard";
  - `start_url: "/app"`;
  - `display: "standalone"`;
  - theme colours from `globals.css`;
  - icons `public/icon.png` (192) plus a 512 version.
- This also makes push notifications work on iPhone, which requires adding the app to the Home Screen.

### 2.4 Optional before launch
- Simple analytics, cookie-free (Vercel Analytics or Plausible). Update the CSP `connect-src` in `next.config.ts` if needed.
- An Open Graph image check for `/` and `/for/[role]`.

---

## Phase 3: Staging test with real services [You + AI]

Deploy to a Vercel preview with real keys, then tick each item:

- [ ] Sign up with an email magic link, then with Google, then sign out and back in.
- [ ] Onboarding works for all 4 fields (Software Engineer, Designer, Teacher, Marketer).
- [ ] Clients, projects, tasks:
  - [ ] create, edit and delete each;
  - [ ] Ctrl+K search finds them.
- [ ] Invoices:
  - [ ] create two quickly and confirm they get different numbers;
  - [ ] mark paid → the income appears once;
  - [ ] unmark → the income is removed;
  - [ ] the email reaches the client inbox (not spam).
- [ ] Repeating expense with a past start date → the missed entries are added.
- [ ] Multi-currency: add a PKR entry with USD as the profile currency → the total is converted and the "Rates By Exchange Rate API" credit shows.
- [ ] Google Calendar:
  - [ ] connect;
  - [ ] see events;
  - [ ] create an event;
  - [ ] disconnect.
- [ ] Cron jobs. Call both with the bearer secret:

  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/collect
  curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/automations
  ```

  - [ ] Opportunities show live jobs.
  - [ ] `/api/health` returns ok.
- [ ] The daily digest arrives at the chosen hour.
- [ ] Push: turn it on, then "Send a test" arrives on your phone.
- [ ] AI draft: "Draft it" returns a Claude-written draft.
- [ ] **Security:**
  - [ ] with two different accounts, user B cannot see user A's data, including when opening A's URLs directly;
  - [ ] logged out, `/app` redirects to `/login`.
- [ ] Mobile: check every page at phone width, with no sideways scrolling.

---

## Phase 4: Launch-day safety [You]

- **Uptime monitor:** UptimeRobot (free) on `https://YOUR-DOMAIN/api/health`, alerting by email.
- **Error alerts:** `ALERT_WEBHOOK_URL` is set, and you have tested it once.
- **Backups:** the Supabase free plan has limited backups. For real user data, upgrade to Pro, or export the database weekly with `pg_dump`.
- **Secrets:** keep a safe copy of `TOKEN_ENCRYPTION_KEY` and `CRON_SECRET` in a password manager.

---

## Not needed for the beta (later)

- **Billing**, before Pro becomes paid: Stripe internationally, and a Pakistan option such as PayFast, JazzCash or Easypaisa.
- **Quick wins:**
  - quick add ("Lunch 500 PKR yesterday");
  - CSV import;
  - invoice PDF download and automatic payment reminders;
  - P&L export;
  - repeating invoices.
- **Bigger features:**
  - time tracking → invoice;
  - your own "When → Then" automation rules;
  - client portal;
  - payment links;
  - WhatsApp sending;
  - teacher marks and progress reports;
  - an Urdu (right-to-left) interface.
- **Growth:**
  - team seats;
  - more professions;
  - a Flutter mobile app;
  - an AI assistant over the whole dashboard.

### Known limits to remember
- **CSP:** inline scripts are still allowed. Nonce-based CSP is incompatible with Partial Prerendering (Next.js docs); script files are protected with Subresource Integrity instead.
- **Rate limiter:** it fails open if Upstash is down, so users are never locked out.
- **Pay matching:** it estimates whether a posted salary is hourly, monthly or yearly from its size, so it shows as approximate.
