-- Run this once in the Supabase SQL editor if seed fails with
-- "permission denied for table …"
-- Then re-run: npm run seed:supabase

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to postgres, anon, authenticated, service_role;

-- Explicit table grants for this app
grant all on table
  public.coaches,
  public.athletes,
  public.blocks,
  public.plans,
  public.schedule_overrides,
  public.set_logs,
  public.videos,
  public.e1rm_series,
  public.messages,
  public.coaching_stints,
  public.email_verifications,
  public.connection_requests
to anon, authenticated, service_role;
