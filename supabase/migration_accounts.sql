-- Account email + verification + delete support
-- Run after migration_coaching_units.sql

alter table public.coaches
  add column if not exists email text,
  add column if not exists email_verified boolean not null default false;

alter table public.athletes
  add column if not exists email text,
  add column if not exists email_verified boolean not null default false;

create unique index if not exists coaches_email_unique
  on public.coaches (lower(email))
  where email is not null and email <> '';

create unique index if not exists athletes_email_unique
  on public.athletes (lower(email))
  where email is not null and email <> '';

create table if not exists public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  role text not null check (role in ('coach', 'athlete')),
  payload jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_verifications_email_idx
  on public.email_verifications (lower(email), created_at desc);

alter table public.email_verifications enable row level security;

drop policy if exists "dev_all_email_verifications" on public.email_verifications;
create policy "dev_all_email_verifications" on public.email_verifications
  for all using (true) with check (true);

grant all on table public.email_verifications to anon, authenticated, service_role;

notify pgrst, 'reload schema';
