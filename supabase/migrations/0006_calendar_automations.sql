-- Connected accounts (Google Calendar), automation settings and the automation log.

-- Refresh tokens are encrypted by the app (AES-256-GCM, key only on the server) before they
-- are stored, so the value in this table is useless without TOKEN_ENCRYPTION_KEY.
create table if not exists public.integrations (
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider          text not null check (provider in ('google')),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 4000),
  account_email     text check (account_email is null or char_length(account_email) <= 254),
  scope             text not null default '' check (char_length(scope) <= 1000),
  connected_at      timestamptz not null default now(),
  primary key (owner_id, provider)
);

create table if not exists public.automation_settings (
  owner_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  rules           jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  digest_enabled  boolean not null default true,
  digest_hour     smallint not null default 8 check (digest_hour between 0 and 23),
  last_digest_on  date,
  updated_at      timestamptz not null default now()
);

create table if not exists public.automation_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rule_id     text not null check (char_length(rule_id) <= 60),
  key         text not null check (char_length(key) <= 200),
  message     text not null check (char_length(message) <= 300),
  created_at  timestamptz not null default now(),
  unique (owner_id, rule_id, key)   -- makes every rule idempotent
);
create index if not exists automation_log_owner_idx on public.automation_log (owner_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['integrations', 'automation_settings', 'automation_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
