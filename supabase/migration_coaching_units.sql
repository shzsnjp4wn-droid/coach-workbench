-- IRON//WORKBENCH — coaching units, stints, GL profile fields
-- Run in Supabase SQL editor after schema.sql (safe to re-run).

-- ---------------------------------------------------------------------------
-- Athlete profile: bodyweight + sex (for IPF GL / "DOTS" helper)
-- ---------------------------------------------------------------------------
alter table public.athletes
  add column if not exists bodyweight_kg numeric,
  add column if not exists sex text not null default 'male';

alter table public.athletes drop constraint if exists athletes_sex_check;
alter table public.athletes
  add constraint athletes_sex_check check (sex in ('male', 'female'));

-- ---------------------------------------------------------------------------
-- coaching_stints — one active tenure per athlete
-- ---------------------------------------------------------------------------
create table if not exists public.coaching_stints (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes (id) on delete cascade,
  coach_id text not null references public.coaches (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  start_bodyweight_kg numeric,
  start_total_kg numeric,
  start_dots numeric,
  end_total_kg numeric,
  end_dots numeric,
  transfer_history boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists coaching_stints_one_active_per_athlete
  on public.coaching_stints (athlete_id)
  where (status = 'active');

create index if not exists coaching_stints_coach_idx
  on public.coaching_stints (coach_id, status);

alter table public.coaching_stints enable row level security;

drop policy if exists "dev_all_coaching_stints" on public.coaching_stints;
create policy "dev_all_coaching_stints" on public.coaching_stints
  for all using (true) with check (true);

grant all on table public.coaching_stints to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Add coach_id attribution to unit tables (nullable first, then backfill)
-- ---------------------------------------------------------------------------
alter table public.blocks add column if not exists coach_id text references public.coaches (id);
alter table public.plans add column if not exists coach_id text references public.coaches (id);
alter table public.schedule_overrides add column if not exists coach_id text references public.coaches (id);
alter table public.set_logs add column if not exists coach_id text references public.coaches (id);
alter table public.videos add column if not exists coach_id text references public.coaches (id);
alter table public.e1rm_series add column if not exists coach_id text references public.coaches (id);
alter table public.messages add column if not exists coach_id text references public.coaches (id);

-- Backfill from athlete's current coach (or first coach in DB)
update public.blocks b
set coach_id = coalesce(
  (select a.coach_id from public.athletes a where a.id = b.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where b.coach_id is null;

update public.plans p
set coach_id = coalesce(
  (select b.coach_id from public.blocks b where b.athlete_id = p.athlete_id and b.block_key = p.block_key),
  (select a.coach_id from public.athletes a where a.id = p.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where p.coach_id is null;

update public.schedule_overrides o
set coach_id = coalesce(
  (select a.coach_id from public.athletes a where a.id = o.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where o.coach_id is null;

update public.set_logs l
set coach_id = coalesce(
  (select a.coach_id from public.athletes a where a.id = l.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where l.coach_id is null;

update public.videos v
set coach_id = coalesce(
  (select a.coach_id from public.athletes a where a.id = v.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where v.coach_id is null;

update public.e1rm_series s
set coach_id = coalesce(
  (select a.coach_id from public.athletes a where a.id = s.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where s.coach_id is null;

update public.messages m
set coach_id = coalesce(
  (select a.coach_id from public.athletes a where a.id = m.athlete_id),
  (select c.id from public.coaches c order by c.created_at limit 1)
)
where m.coach_id is null;

-- Drop rows that still cannot resolve a coach (orphan data)
delete from public.plans where coach_id is null;
delete from public.schedule_overrides where coach_id is null;
delete from public.blocks where coach_id is null;
delete from public.set_logs where coach_id is null;
delete from public.videos where coach_id is null;
delete from public.e1rm_series where coach_id is null;
delete from public.messages where coach_id is null;

-- Rebuild blocks / plans keys to include coach_id (isolated coach–athlete units)
alter table public.schedule_overrides drop constraint if exists schedule_overrides_athlete_id_block_key_fkey;
alter table public.plans drop constraint if exists plans_athlete_id_block_key_fkey;

alter table public.blocks drop constraint if exists blocks_pkey;
alter table public.blocks alter column coach_id set not null;
alter table public.blocks add primary key (athlete_id, coach_id, block_key);

alter table public.plans drop constraint if exists plans_pkey;
alter table public.plans alter column coach_id set not null;
alter table public.plans add primary key (athlete_id, coach_id, block_key);
alter table public.plans
  add constraint plans_block_fkey
  foreign key (athlete_id, coach_id, block_key)
  references public.blocks (athlete_id, coach_id, block_key)
  on delete cascade;

alter table public.schedule_overrides drop constraint if exists schedule_overrides_athlete_id_block_key_week_index_day_index_key;
alter table public.schedule_overrides alter column coach_id set not null;
alter table public.schedule_overrides
  add constraint schedule_overrides_unit_unique
  unique (athlete_id, coach_id, block_key, week_index, day_index);
alter table public.schedule_overrides
  add constraint schedule_overrides_block_fkey
  foreign key (athlete_id, coach_id, block_key)
  references public.blocks (athlete_id, coach_id, block_key)
  on delete cascade;

alter table public.set_logs alter column coach_id set not null;
alter table public.videos alter column coach_id set not null;
alter table public.messages alter column coach_id set not null;

-- e1rm_series: one point per athlete/coach/day
alter table public.e1rm_series drop constraint if exists e1rm_series_pkey;
alter table public.e1rm_series alter column coach_id set not null;
alter table public.e1rm_series add primary key (athlete_id, coach_id, date);

create index if not exists messages_pair_at_idx on public.messages (athlete_id, coach_id, at);
create index if not exists set_logs_coach_idx on public.set_logs (athlete_id, coach_id, date desc);
create index if not exists videos_coach_idx on public.videos (athlete_id, coach_id, date desc);

notify pgrst, 'reload schema';
