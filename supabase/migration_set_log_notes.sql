-- Optional notes on logged sets (athlete comments / coach reply targets)
alter table public.set_logs add column if not exists note text;
notify pgrst, 'reload schema';
