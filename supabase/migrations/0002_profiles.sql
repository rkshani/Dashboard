-- User profiles: one row per signed-in user, filled by onboarding.
-- Row-level security: a user can only ever see and change their own row.

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 60),
  template_id   text not null default 'software-engineer' check (template_id ~ '^[a-z0-9-]{1,40}$'),
  skills        text[] not null default '{}' check (cardinality(skills) <= 25),
  work_types    text[] not null default '{}' check (cardinality(work_types) <= 6),
  rate_min      numeric(12, 2) check (rate_min is null or rate_min >= 0),
  rate_max      numeric(12, 2) check (rate_max is null or rate_max >= 0),
  currency      text not null default 'USD' check (currency in ('USD', 'PKR', 'EUR', 'GBP', 'AED', 'INR')),
  remote_pref   text not null default 'remote' check (remote_pref in ('remote', 'hybrid', 'onsite', 'any')),
  regions       text[] not null default '{}' check (cardinality(regions) <= 10),
  timezone      text not null default 'UTC' check (char_length(timezone) <= 64),
  theme         text not null default 'midnight' check (theme in ('midnight', 'daylight', 'forest', 'dusk')),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint rate_range check (rate_min is null or rate_max is null or rate_min <= rate_max)
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- No delete policy: accounts are deleted through auth.users (cascades here).
revoke all on public.profiles from anon;

-- Keep updated_at current.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
