-- Adds scheduling and photo fields to service requests (location reuses the
-- existing location_data jsonb column), plus a private storage bucket for
-- request photos with folder-per-user access control.
-- Additive only. Safe to run once against the existing schema.

alter table service_requests add column if not exists scheduled_date date;
alter table service_requests add column if not exists scheduled_time text;
alter table service_requests add column if not exists photo_urls text[] not null default '{}';

-- Storage bucket for request photos (private; access controlled via RLS below).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-photos',
  'request-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Uploads must go under a folder named after the uploader's own auth uid.
create policy request_photos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The uploader can always see their own photos; admin and any
-- reseller/wholesaler/technician can see all of them - they need to triage
-- and work jobs regardless of who ends up assigned.
create policy request_photos_select on storage.objects
  for select using (
    bucket_id = 'request-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or public."current_role"() = any (array['reseller', 'wholesaler', 'technician']::user_role[])
    )
  );

create policy request_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'request-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
