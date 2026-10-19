-- Income/expense transactions and invoices. Owner-only RLS like the other tables.

create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  number      text not null check (char_length(number) between 1 and 40),
  issue_date  date not null default current_date,
  due_date    date,
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- [{ "description": text, "quantity": number, "rate": number }], max 50 lines
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 50),
  total       numeric(14, 2) not null default 0 check (total >= 0),
  status      text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  paid_at     date,
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, number)
);

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('income', 'expense')),
  amount      numeric(14, 2) not null check (amount > 0),
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  category    text not null default 'Other' check (char_length(category) between 1 and 40),
  date        date not null default current_date,
  note        text check (note is null or char_length(note) <= 300),
  client_id   uuid references public.clients (id) on delete set null,
  project_id  uuid references public.projects (id) on delete set null,
  invoice_id  uuid references public.invoices (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists transactions_owner_date_idx on public.transactions (owner_id, date desc);
create index if not exists invoices_owner_status_idx on public.invoices (owner_id, status, due_date);

-- Same-owner check for links (reuses the idea from 0003, extended to the new tables).
create or replace function public.assert_same_owner_finance()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
    raise exception 'client not found';
  end if;
  if new.project_id is not null and not exists (select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.owner_id) then
    raise exception 'project not found';
  end if;
  if tg_table_name = 'transactions' and new.invoice_id is not null
     and not exists (select 1 from public.invoices i where i.id = new.invoice_id and i.owner_id = new.owner_id) then
    raise exception 'invoice not found';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_same_owner on public.invoices;
create trigger invoices_same_owner before insert or update on public.invoices
  for each row execute function public.assert_same_owner_finance();
drop trigger if exists transactions_same_owner on public.transactions;
create trigger transactions_same_owner before insert or update on public.transactions
  for each row execute function public.assert_same_owner_finance();

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['invoices', 'transactions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
