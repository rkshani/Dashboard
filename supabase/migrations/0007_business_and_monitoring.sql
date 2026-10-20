-- Business details printed on invoices, and heartbeats for scheduled jobs.

create table if not exists public.business_profiles (
  owner_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  business_name    text check (business_name is null or char_length(business_name) <= 120),
  address          text check (address is null or char_length(address) <= 500),
  tax_id           text check (tax_id is null or char_length(tax_id) <= 60),
  contact_email    text check (contact_email is null or char_length(contact_email) <= 254),
  phone            text check (phone is null or char_length(phone) <= 40),
  payment_details  text check (payment_details is null or char_length(payment_details) <= 1000),
  default_due_days smallint not null default 14 check (default_due_days between 0 and 120),
  updated_at       timestamptz not null default now()
);

alter table public.business_profiles enable row level security;
drop policy if exists "owner full access" on public.business_profiles;
create policy "owner full access" on public.business_profiles for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.business_profiles from anon;

-- Written only by scheduled jobs (service role). No policies = no access for signed-in users.
create table if not exists public.job_runs (
  job          text primary key check (char_length(job) <= 60),
  last_run_at  timestamptz not null,
  last_ok_at   timestamptz,
  last_error   text check (last_error is null or char_length(last_error) <= 500),
  details      jsonb not null default '{}'::jsonb
);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;
