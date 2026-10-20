-- Repeating tasks and repeating income/expenses.

alter table public.tasks add column if not exists repeat text not null default 'none'
  check (repeat in ('none', 'daily', 'weekdays', 'weekly', 'monthly'));

create table if not exists public.recurring_transactions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  amount      numeric(14, 2) not null check (amount > 0),
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  category    text not null default 'Other' check (char_length(category) between 1 and 40),
  note        text check (note is null or char_length(note) <= 300),
  client_id   uuid references public.clients (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  cadence     text not null check (cadence in ('weekly', 'monthly', 'yearly')),
  start_date  date not null,
  next_date   date not null,
  created_at  timestamptz not null default now()
);

create index if not exists recurring_owner_next_idx on public.recurring_transactions (owner_id, next_date);

alter table public.recurring_transactions enable row level security;
drop policy if exists "owner full access" on public.recurring_transactions;
create policy "owner full access" on public.recurring_transactions for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.recurring_transactions from anon;

-- A rule can only point at the owner's own client and project.
drop trigger if exists recurring_same_owner on public.recurring_transactions;
create trigger recurring_same_owner before insert or update on public.recurring_transactions
  for each row execute function public.assert_same_owner_finance();
