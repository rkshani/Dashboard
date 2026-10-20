insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'), ('bbbbbbbb-0000-4000-8000-000000000002');
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-0000-4000-8000-000000000001';
select number from public.create_invoice('aaaaaaaa-0000-4000-8000-000000000001', null, null, '2026-10-20', null, 'USD', '[{"description":"x","quantity":1,"rate":100}]', 100, null);
select number from public.create_invoice('aaaaaaaa-0000-4000-8000-000000000001', null, null, '2026-10-20', null, 'USD', '[]', 50, null);
select public.set_invoice_status('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.invoices where number='INV-0001'), 'paid', '2026-10-20');
select public.set_invoice_status('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.invoices where number='INV-0001'), 'paid', '2026-10-20');
select 'income rows after double paid: ' || count(*) from public.transactions where invoice_id is not null;
select public.set_invoice_status('aaaaaaaa-0000-4000-8000-000000000001', (select id from public.invoices where number='INV-0001'), 'sent', '2026-10-20');
select 'income rows after unpaid: ' || count(*) from public.transactions;
-- Another user cannot act as user A
set request.jwt.claim.sub = 'bbbbbbbb-0000-4000-8000-000000000002';
do $$ begin perform public.create_invoice('aaaaaaaa-0000-4000-8000-000000000001', null, null, '2026-10-20', null, 'USD', '[]', 1, null); raise notice 'SPOOF ALLOWED'; exception when others then raise notice 'spoof blocked: %', sqlerrm; end $$;
do $$ begin perform public.set_invoice_status('bbbbbbbb-0000-4000-8000-000000000002', (select id from public.invoices limit 1), 'paid', '2026-10-20'); raise notice 'B paid A invoice?'; exception when others then raise notice 'cross-user blocked: %', sqlerrm; end $$;
select 'B new invoice: ' || number from public.create_invoice('bbbbbbbb-0000-4000-8000-000000000002', null, null, '2026-10-20', null, 'USD', '[]', 1, null);
reset role;
set role anon;
do $$ begin perform public.create_invoice('aaaaaaaa-0000-4000-8000-000000000001', null, null, '2026-10-20', null, 'USD', '[]', 1, null); raise notice 'ANON ALLOWED'; exception when others then raise notice 'anon blocked: %', sqlerrm; end $$;
