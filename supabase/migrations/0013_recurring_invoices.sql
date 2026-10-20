-- Repeating invoices: a saved invoice that is issued again every week, month or year
-- (a retainer, a monthly fee). Each occurrence becomes a normal invoice with its own number.
-- Safe to re-run.

create table if not exists public.recurring_invoices (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- Same shape and limit as invoices.items: [{ "description", "quantity", "rate" }], max 50 lines
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 50),
  total       numeric(14, 2) not null default 0 check (total >= 0),
  notes       text check (notes is null or char_length(notes) <= 2000),
  cadence     text not null check (cadence in ('weekly', 'monthly', 'yearly')),
  -- Each new invoice is due this many days after it is issued.
  due_days    integer not null default 14 check (due_days between 0 and 365),
  -- Email each new invoice to the client automatically (otherwise it is created as a draft).
  auto_send   boolean not null default false,
  start_date  date not null,
  next_date   date not null,
  created_at  timestamptz not null default now()
);

create index if not exists recurring_invoices_owner_next_idx on public.recurring_invoices (owner_id, next_date);

alter table public.recurring_invoices enable row level security;
drop policy if exists "owner full access" on public.recurring_invoices;
create policy "owner full access" on public.recurring_invoices for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.recurring_invoices from anon;

-- Can only point at the owner's own client and project (same check as invoices and transactions).
drop trigger if exists recurring_invoices_same_owner on public.recurring_invoices;
create trigger recurring_invoices_same_owner before insert or update on public.recurring_invoices
  for each row execute function public.assert_same_owner_finance();
