-- IRON//WORKBENCH — Step 1 schema
-- Paste into the Supabase SQL editor and run once.
-- Mirrors the mock workspace in src/domain.js (createWorkspace).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- coaches
-- ---------------------------------------------------------------------------
create table if not exists public.coaches (
  id text primary key,
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- athletes
-- ---------------------------------------------------------------------------
create table if not exists public.athletes (
  id text primary key,
  name text not null,
  code text not null unique,
  coach_id text references public.coaches (id) on delete set null,
  event text not null default '',
  meet_date date,
  planning_mode text not null default 'meet' check (planning_mode in ('meet', 'block')),
  block_weeks integer not null default 16,
  start_date date not null,
  -- { squat, bench, deadlift }
  pbs jsonb not null default '{"squat":0,"bench":0,"deadlift":0}'::jsonb,
  e1rm jsonb not null default '{"squat":0,"bench":0,"deadlift":0}'::jsonb,
  -- [{ id, name, group }]
  accessory_library jsonb not null default '[]'::jsonb,
  -- { squat: [{id,name,modifier}], bench: [...], deadlift: [...] }
  lift_library jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athletes_coach_id_idx on public.athletes (coach_id);

-- ---------------------------------------------------------------------------
-- blocks  (client keys like b1 are unique per athlete, not globally)
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  athlete_id text not null references public.athletes (id) on delete cascade,
  block_key text not null,
  name text not null,
  weeks integer not null check (weeks >= 1),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (athlete_id, block_key)
);

-- ---------------------------------------------------------------------------
-- plans  (full microcycle JSON kept as jsonb to match domain plan shape)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  athlete_id text not null,
  block_key text not null,
  same_every_week boolean not null default true,
  -- { squat, bench, deadlift }
  frequency jsonb not null default '{"squat":2,"bench":2,"deadlift":1}'::jsonb,
  -- [{ days: [{ id, weekday, active, items: [...] }] }]
  weeks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (athlete_id, block_key),
  foreign key (athlete_id, block_key) references public.blocks (athlete_id, block_key) on delete cascade
);

-- ---------------------------------------------------------------------------
-- schedule_overrides
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  athlete_id text not null references public.athletes (id) on delete cascade,
  block_key text not null,
  week_index integer not null,
  day_index integer not null check (day_index between 0 and 6),
  prescribed_weekday text not null,
  actual_weekday text not null,
  date date not null,
  unique (athlete_id, block_key, week_index, day_index),
  foreign key (athlete_id, block_key) references public.blocks (athlete_id, block_key) on delete cascade
);

-- ---------------------------------------------------------------------------
-- set_logs
-- ---------------------------------------------------------------------------
create table if not exists public.set_logs (
  id text primary key,
  athlete_id text not null references public.athletes (id) on delete cascade,
  set_key text,
  block_key text,
  week_index integer,
  day_index integer,
  set_number integer,
  exercise text,
  label text,
  lift text check (lift is null or lift in ('squat', 'bench', 'deadlift')),
  weight numeric,
  reps numeric,
  rpe numeric,
  e1 numeric,
  date date not null,
  video_id text,
  created_at timestamptz not null default now()
);

create index if not exists set_logs_athlete_date_idx on public.set_logs (athlete_id, date desc);
create index if not exists set_logs_session_idx
  on public.set_logs (athlete_id, block_key, week_index, day_index, set_key);

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------
create table if not exists public.videos (
  id text primary key,
  athlete_id text not null references public.athletes (id) on delete cascade,
  log_id text references public.set_logs (id) on delete set null,
  date date not null,
  block_key text,
  block_name text,
  week_index integer,
  day_index integer,
  set_number integer,
  exercise text,
  label text,
  lift text check (lift is null or lift in ('squat', 'bench', 'deadlift')),
  reps numeric,
  weight numeric,
  rpe numeric,
  url text,
  type text not null default '',
  name text not null default '',
  caption text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists videos_athlete_date_idx on public.videos (athlete_id, date desc);

-- set_logs.video_id → videos.id (added after videos exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'set_logs_video_id_fkey'
  ) then
    alter table public.set_logs
      add constraint set_logs_video_id_fkey
      foreign key (video_id) references public.videos (id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- e1rm_series  (one row per athlete per calendar day)
-- ---------------------------------------------------------------------------
create table if not exists public.e1rm_series (
  athlete_id text not null references public.athletes (id) on delete cascade,
  date date not null,
  squat numeric,
  bench numeric,
  deadlift numeric,
  primary key (athlete_id, date)
);

-- ---------------------------------------------------------------------------
-- messages  (thread keyed by athlete_id, coach ↔ athlete)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id text primary key,
  athlete_id text not null references public.athletes (id) on delete cascade,
  from_role text not null check (from_role in ('coach', 'athlete')),
  text text not null default '',
  at timestamptz not null,
  -- { url, name, type, size, kind } | null
  attachment jsonb,
  unread boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_athlete_at_idx on public.messages (athlete_id, at);

-- ---------------------------------------------------------------------------
-- Dev-friendly RLS: allow anon/authenticated full access while the UI
-- still uses mock state. Tighten before shipping auth.
-- ---------------------------------------------------------------------------
alter table public.coaches enable row level security;
alter table public.athletes enable row level security;
alter table public.blocks enable row level security;
alter table public.plans enable row level security;
alter table public.schedule_overrides enable row level security;
alter table public.set_logs enable row level security;
alter table public.videos enable row level security;
alter table public.e1rm_series enable row level security;
alter table public.messages enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'coaches', 'athletes', 'blocks', 'plans', 'schedule_overrides',
    'set_logs', 'videos', 'e1rm_series', 'messages'
  ]
  loop
    execute format('drop policy if exists "dev_all_%1$s" on public.%1$s', t);
    execute format(
      'create policy "dev_all_%1$s" on public.%1$s for all using (true) with check (true)',
      t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
