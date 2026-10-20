-- Clients, projects and tasks. Every row belongs to one user (owner_id) and
-- row-level security limits every operation to the owner.

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  company     text check (company is null or char_length(company) <= 120),
  email       text check (email is null or char_length(email) <= 254),
  phone       text check (phone is null or char_length(phone) <= 40),
  status      text not null default 'active' check (status in ('lead', 'active', 'past')),
  notes       text check (notes is null or char_length(notes) <= 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 160),
  status      text not null default 'planning' check (status in ('planning', 'active', 'review', 'done')),
  deadline    date,
  budget      numeric(14, 2) check (budget is null or budget >= 0),
  description text check (description is null or char_length(description) <= 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 200),
  due_date    date,
  priority    text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists clients_owner_idx on public.clients (owner_id, created_at desc);
create index if not exists projects_owner_idx on public.projects (owner_id, status);
create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists tasks_owner_idx on public.tasks (owner_id, done, due_date);
create index if not exists tasks_project_idx on public.tasks (project_id);

-- A user may only link to their own client / project (stops cross-account references).
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

drop trigger if exists projects_same_owner on public.projects;
create trigger projects_same_owner before insert or update on public.projects
  for each row execute function public.assert_same_owner();
drop trigger if exists tasks_same_owner on public.tasks;
create trigger tasks_same_owner before insert or update on public.tasks
  for each row execute function public.assert_same_owner();

-- updated_at (function created in 0002)
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- Row-level security: owner only, for every operation.
do $$
declare t text;
begin
  foreach t in array array['clients', 'projects', 'tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner full access" on public.%I', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
