-- Adds a public storage bucket for profile avatars (photo icon, editable by
-- every role) and a skill_ids column so technicians/resellers can select
-- multiple service categories they're skilled in, for future job matching.
-- Additive only. Safe to run once against the existing schema.

alter table profiles add column if not exists skill_ids uuid[] not null default '{}';

-- Storage bucket for avatars (public; shown broadly across the app, unlike
-- the private request-photos bucket).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Users manage their own avatar under a folder named after their own auth uid.
create policy avatars_insert_own on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Avatars are public - anyone (including signed-out visitors) can view them.
create policy avatars_select_all on storage.objects
  for select using (bucket_id = 'avatars');
