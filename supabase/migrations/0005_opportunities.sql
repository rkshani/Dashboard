-- Opportunity engine.
-- `opportunities` is a shared pool of public postings written only by the collector
-- (service role, which bypasses RLS). Signed-in users can read it.
-- `user_opportunities` holds each user's own status for a posting (saved, applied...).

create table if not exists public.opportunities (
  id               text primary key check (char_length(id) <= 200),       -- "{source}:{externalId}"
  source           text not null check (char_length(source) <= 30),
  fingerprint      text not null,
  kind             text not null check (kind in ('job', 'lead')),
  title            text not null check (char_length(title) <= 160),
  company          text not null check (char_length(company) <= 120),
  url              text not null check (url ~ '^https?://' and char_length(url) <= 1000),
  location         text not null default '' check (char_length(location) <= 120),
  remote           boolean not null default false,
  tags             text[] not null default '{}',
  description      text not null default '' check (char_length(description) <= 4000),
  salary_min       numeric,
  salary_max       numeric,
  salary_currency  text,
  posted_at        timestamptz not null,
  attribution_name text not null,
  fetched_at       timestamptz not null default now()
);

create index if not exists opportunities_posted_idx on public.opportunities (posted_at desc);
create index if not exists opportunities_fingerprint_idx on public.opportunities (fingerprint);
create index if not exists opportunities_tags_idx on public.opportunities using gin (tags);

alter table public.opportunities enable row level security;
drop policy if exists "signed-in users can read" on public.opportunities;
create policy "signed-in users can read" on public.opportunities for select to authenticated using (true);
revoke insert, update, delete on public.opportunities from anon, authenticated;
revoke all on public.opportunities from anon;

create table if not exists public.user_opportunities (
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id  text not null references public.opportunities (id) on delete cascade,
  status          text not null check (status in ('new', 'saved', 'contacted', 'proposal', 'won', 'lost', 'dismissed')),
  updated_at      timestamptz not null default now(),
  primary key (owner_id, opportunity_id)
);

alter table public.user_opportunities enable row level security;
drop policy if exists "owner full access" on public.user_opportunities;
create policy "owner full access" on public.user_opportunities for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.user_opportunities from anon;
