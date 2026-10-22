-- Optional: run in Supabase SQL editor so set clips / message attachments
-- upload to Storage instead of staying as local blob URLs.
-- App still works without this; uploads simply stay local until a bucket exists.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

drop policy if exists "media_anon_upload" on storage.objects;
create policy "media_anon_upload"
  on storage.objects for insert
  with check (bucket_id = 'media');

drop policy if exists "media_anon_update" on storage.objects;
create policy "media_anon_update"
  on storage.objects for update
  using (bucket_id = 'media')
  with check (bucket_id = 'media');
