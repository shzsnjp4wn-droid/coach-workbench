-- Mutual coach ↔ athlete connection requests + larger media uploads
-- Run after migration_accounts.sql

update storage.buckets
set file_size_limit = 209715200
where id = 'media';

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes (id) on delete cascade,
  coach_id text not null references public.coaches (id) on delete cascade,
  initiated_by text not null check (initiated_by in ('athlete', 'coach')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  transfer_history boolean not null default false,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- One pending request per pair. Do NOT unique on (athlete, coach, status) —
-- that blocks reconnect after an earlier accepted/declined row.
alter table public.connection_requests
  drop constraint if exists connection_requests_athlete_id_coach_id_status_key;

create unique index if not exists connection_requests_one_pending
  on public.connection_requests (athlete_id, coach_id)
  where (status = 'pending');

create index if not exists connection_requests_athlete_pending_idx
  on public.connection_requests (athlete_id, status, created_at desc);

create index if not exists connection_requests_coach_pending_idx
  on public.connection_requests (coach_id, status, created_at desc);

alter table public.connection_requests enable row level security;

drop policy if exists "dev_all_connection_requests" on public.connection_requests;
create policy "dev_all_connection_requests" on public.connection_requests
  for all using (true) with check (true);

grant all on table public.connection_requests to anon, authenticated, service_role;

notify pgrst, 'reload schema';
