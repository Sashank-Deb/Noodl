-- noodl: cloud mirror for notes and folders.
-- One row per note (the whole node tree in `data`). Row-level security makes
-- every row visible only to its owner. `server_updated_at` is stamped by the
-- database on every write, so clients can pull "everything changed since X"
-- without trusting device clocks.

create table if not exists public.notes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (octet_length(data::text) < 1000000),
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.folders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 64),
  data jsonb not null check (char_length(coalesce(data->>'name', '')) <= 200 and octet_length(data::text) < 10000),
  updated_at bigint not null,
  deleted_at bigint,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists notes_user_server_updated on public.notes (user_id, server_updated_at);
create index if not exists folders_user_server_updated on public.folders (user_id, server_updated_at);

-- Server-side timestamp on every insert/update (clients can't backdate it).
create or replace function public.noodl_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before insert or update on public.notes
  for each row execute function public.noodl_touch();
drop trigger if exists folders_touch on public.folders;
create trigger folders_touch before insert or update on public.folders
  for each row execute function public.noodl_touch();

-- Row-level security: owners only.
alter table public.notes enable row level security;
alter table public.folders enable row level security;

drop policy if exists "notes: owner" on public.notes;
create policy "notes: owner" on public.notes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "folders: owner" on public.folders;
create policy "folders: owner" on public.folders
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notes, public.folders from anon;
grant select, insert, update, delete on public.notes, public.folders to authenticated;

-- Realtime: stream row changes to the owner's open tabs (RLS applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notes;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.folders;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;
