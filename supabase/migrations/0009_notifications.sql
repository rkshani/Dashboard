-- In-app notifications and browser push subscriptions.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('match', 'deadline', 'invoice', 'money', 'task', 'system')),
  title       text not null check (char_length(title) between 1 and 160),
  body        text check (body is null or char_length(body) <= 500),
  href        text check (href is null or (href like '/app%' and char_length(href) <= 300)),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists notifications_owner_created_idx on public.notifications (owner_id, created_at desc);
create index if not exists notifications_owner_unread_idx on public.notifications (owner_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "owner full access" on public.notifications;
create policy "owner full access" on public.notifications for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.notifications from anon;

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "owner full access" on public.push_subscriptions;
create policy "owner full access" on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.push_subscriptions from anon;

-- Notifications older than 90 days are removed by the hourly automations job.
