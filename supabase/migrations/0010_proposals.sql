-- Saved proposal / cover-letter drafts, one per user per opportunity.
create table if not exists public.proposals (
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id  text not null check (char_length(opportunity_id) <= 140),
  body            text not null check (char_length(body) <= 6000),
  source          text not null default 'edited' check (source in ('ai', 'template', 'edited')),
  updated_at      timestamptz not null default now(),
  primary key (owner_id, opportunity_id)
);

alter table public.proposals enable row level security;
drop policy if exists "owner full access" on public.proposals;
create policy "owner full access" on public.proposals for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.proposals from anon;
