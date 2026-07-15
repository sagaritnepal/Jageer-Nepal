-- Storage bucket for catalog product photos, so admins can upload a real
-- image instead of pasting an external URL. Catalog items are admin-managed
-- only (see 0004_admin_catalog.sql), so writes are admin-gated; reads are
-- public since these photos are shown to every role browsing the catalog.
-- Additive only. Safe to run once against the existing schema.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy catalog_images_insert_admin on storage.objects
  for insert with check (bucket_id = 'catalog-images' and is_admin());

create policy catalog_images_update_admin on storage.objects
  for update using (bucket_id = 'catalog-images' and is_admin())
  with check (bucket_id = 'catalog-images' and is_admin());

create policy catalog_images_delete_admin on storage.objects
  for delete using (bucket_id = 'catalog-images' and is_admin());

create policy catalog_images_select_all on storage.objects
  for select using (bucket_id = 'catalog-images');
