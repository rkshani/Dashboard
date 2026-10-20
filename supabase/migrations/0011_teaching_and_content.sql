-- Teachers: student fees, class membership, attendance and a weekly timetable.
-- Marketers: a content calendar.

alter table public.clients add column if not exists monthly_fee numeric(14, 2) check (monthly_fee is null or monthly_fee >= 0);
alter table public.clients add column if not exists fee_due_day smallint check (fee_due_day is null or fee_due_day between 1 and 28);
alter table public.clients add column if not exists class_id uuid references public.projects (id) on delete set null;

-- A student's class must belong to the same teacher.
create or replace function public.assert_client_class_owner()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.class_id is not null and not exists (select 1 from public.projects p where p.id = new.class_id and p.owner_id = new.owner_id) then
    raise exception 'class not found';
  end if;
  return new;
end;
$$;
drop trigger if exists clients_class_owner on public.clients;
create trigger clients_class_owner before insert or update on public.clients
  for each row execute function public.assert_client_class_owner();

create table if not exists public.attendance (
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  date       date not null,
  status     text not null check (status in ('present', 'late', 'absent')),
  class_id   uuid references public.projects (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, client_id, date)
);
create index if not exists attendance_owner_date_idx on public.attendance (owner_id, date);

create table if not exists public.timetable_slots (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  class_id    uuid not null references public.projects (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  location    text check (location is null or char_length(location) <= 120),
  created_at  timestamptz not null default now()
);
create index if not exists timetable_owner_idx on public.timetable_slots (owner_id, weekday, start_time);

create table if not exists public.content_posts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 160),
  channel      text not null check (char_length(channel) <= 30),
  date         date not null,
  time         time,
  status       text not null default 'idea' check (status in ('idea', 'draft', 'scheduled', 'published')),
  caption      text check (caption is null or char_length(caption) <= 3000),
  campaign_id  uuid references public.projects (id) on delete set null,
  client_id    uuid references public.clients (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists content_owner_date_idx on public.content_posts (owner_id, date);

-- Linked rows (students, classes, campaigns, clients) must belong to the same owner.
create or replace function public.assert_same_owner_teaching()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_table_name = 'attendance' and not exists (select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
    raise exception 'student not found';
  end if;
  if tg_table_name in ('attendance', 'timetable_slots') and new.class_id is not null
     and not exists (select 1 from public.projects p where p.id = new.class_id and p.owner_id = new.owner_id) then
    raise exception 'class not found';
  end if;
  if tg_table_name = 'content_posts' then
    if new.campaign_id is not null and not exists (select 1 from public.projects p where p.id = new.campaign_id and p.owner_id = new.owner_id) then
      raise exception 'campaign not found';
    end if;
    if new.client_id is not null and not exists (select 1 from public.clients c where c.id = new.client_id and c.owner_id = new.owner_id) then
      raise exception 'client not found';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['attendance', 'timetable_slots', 'content_posts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format('create policy "owner full access" on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop trigger if exists %I on public.%I', t || '_same_owner', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.assert_same_owner_teaching()', t || '_same_owner', t);
  end loop;
end;
$$;
