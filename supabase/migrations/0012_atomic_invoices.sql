-- Invoices: make "mark paid" and the matching income entry one transaction,
-- and give each new invoice a unique next number even when two are created at once.

-- 0. Fix: the same-owner checks read columns some tables don't have, which made inserts fail
--    (projects, tasks, invoices, repeating entries). Safe to re-run.
create or replace function public.assert_same_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  -- Nested IFs: PL/pgSQL doesn't short-circuit, so a column is only read on the table that has it.
  if tg_table_name = 'projects' then
    if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
      raise exception 'client not found';
    end if;
  elsif tg_table_name = 'tasks' then
    if new.project_id is not null and not exists (select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.owner_id) then
      raise exception 'project not found';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.assert_same_owner_finance()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
    raise exception 'client not found';
  end if;
  if new.project_id is not null and not exists (select 1 from public.projects p where p.id = new.project_id and p.owner_id = new.owner_id) then
    raise exception 'project not found';
  end if;
  -- Nested IF: only the transactions table has invoice_id (PL/pgSQL doesn't short-circuit field lookups).
  if tg_table_name = 'transactions' then
    if new.invoice_id is not null and not exists (select 1 from public.invoices i where i.id = new.invoice_id and i.owner_id = new.owner_id) then
      raise exception 'invoice not found';
    end if;
  end if;
  return new;
end;
$$;

-- 1. At most one income entry per invoice (remove any accidental duplicates first).
delete from public.transactions t
using public.transactions d
where t.invoice_id is not null and t.invoice_id = d.invoice_id and t.owner_id = d.owner_id
  and (t.created_at, t.id) > (d.created_at, d.id);
create unique index if not exists transactions_one_per_invoice on public.transactions (owner_id, invoice_id) where invoice_id is not null;

-- 2. Change an invoice's status. Paid → records the income; leaving paid → removes it. All or nothing.
create or replace function public.set_invoice_status(p_owner uuid, p_id uuid, p_status text, p_today date)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  inv public.invoices%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_owner then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_status not in ('draft', 'sent', 'paid') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  -- Row lock: two clicks at once are applied one after the other.
  select * into inv from public.invoices where id = p_id and owner_id = p_owner for update;
  if not found then
    raise exception 'invoice not found' using errcode = 'P0002';
  end if;
  if inv.status = p_status then
    return;
  end if;
  update public.invoices set status = p_status, paid_at = case when p_status = 'paid' then p_today else null end
  where id = p_id and owner_id = p_owner;
  if p_status = 'paid' then
    insert into public.transactions (owner_id, kind, amount, currency, category, date, note, client_id, project_id, invoice_id)
    values (p_owner, 'income', inv.total, inv.currency, 'Project payment', p_today, 'Invoice ' || inv.number, inv.client_id, inv.project_id, p_id)
    on conflict (owner_id, invoice_id) where invoice_id is not null do nothing;
  elsif inv.status = 'paid' then
    delete from public.transactions where owner_id = p_owner and invoice_id = p_id;
  end if;
end;
$$;

-- 3. Create an invoice with the next free number (INV-0001, INV-0002, …).
-- A per-user advisory lock means two invoices created at the same moment can't get the same number.
create or replace function public.create_invoice(
  p_owner uuid, p_client uuid, p_project uuid, p_issue date, p_due date,
  p_currency text, p_items jsonb, p_total numeric, p_notes text
) returns public.invoices language plpgsql security invoker set search_path = '' as $$
declare
  next_no int;
  created public.invoices%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_owner then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invoice-number:' || p_owner::text, 0));
  select coalesce(max((substring(number from '(\d+)\s*$'))::int), 0) + 1 into next_no
  from public.invoices where owner_id = p_owner and number ~ '\d+\s*$';
  insert into public.invoices (owner_id, client_id, project_id, number, issue_date, due_date, currency, items, total, notes)
  values (p_owner, p_client, p_project, 'INV-' || lpad(next_no::text, 4, '0'), p_issue, p_due, p_currency, p_items, p_total, p_notes)
  returning * into created;
  return created;
end;
$$;

revoke all on function public.set_invoice_status(uuid, uuid, text, date) from public, anon;
revoke all on function public.create_invoice(uuid, uuid, uuid, date, date, text, jsonb, numeric, text) from public, anon;
grant execute on function public.set_invoice_status(uuid, uuid, text, date) to authenticated, service_role;
grant execute on function public.create_invoice(uuid, uuid, uuid, date, date, text, jsonb, numeric, text) to authenticated, service_role;
