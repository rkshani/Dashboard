-- Waitlist table for the landing page.
-- The public (anon) key may only INSERT. It can never read, update or delete rows.

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null,
  role        text not null default 'software-engineers',
  source      text,
  created_at  timestamptz not null default now(),
  constraint waitlist_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  constraint waitlist_role_len check (char_length(role) <= 64),
  constraint waitlist_source_len check (source is null or char_length(source) <= 64)
);

create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;

-- Insert-only access for anonymous visitors.
drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- No select/update/delete policies: those are denied by default under RLS.
revoke select, update, delete on public.waitlist from anon, authenticated;
grant insert on public.waitlist to anon;
