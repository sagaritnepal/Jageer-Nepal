-- Quotation generator: lets a reseller produce a branded PDF quotation for a
-- client (matching a real hand-typed letterhead template) instead of typing
-- one from scratch in Word each time. Generic per-reseller (every business
-- detail below is nullable and starts blank) - one reseller's real business
-- info/logo/numbering is seeded separately, not by this migration.
-- Additive only. Safe to run once against the existing schema.

alter table profiles add column if not exists business_name text;
alter table profiles add column if not exists business_reg_no text;
alter table profiles add column if not exists business_vat_no text;
alter table profiles add column if not exists business_address text;
alter table profiles add column if not exists business_phone text;
alter table profiles add column if not exists business_logo_path text;

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  quote_seq int not null,
  quote_no text not null,
  quote_date date not null,
  subject text,
  client_name text not null,
  client_address text,
  salesperson_name text,
  salesperson_phone text,
  items jsonb not null default '[]',
  terms text,
  total numeric not null default 0,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotations_owner_idx on quotations(owner_id, quote_seq desc);

alter table quotations enable row level security;

create policy quotations_all_owner on quotations
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy quotations_admin_all on quotations
  for all using (is_admin()) with check (is_admin());

-- Business logos: not sensitive, so a public bucket is simplest - no signed
-- URLs needed to render one in the app or inline it into a generated PDF.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy business_assets_insert_own on storage.objects
  for insert with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy business_assets_select_public on storage.objects
  for select using (bucket_id = 'business-assets');

create policy business_assets_delete_own on storage.objects
  for delete using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Generated quotation PDFs: private, folder-per-owner - same shape as
-- request-photos in 0005_request_details.sql, minus the cross-role read
-- (a quotation is the issuing reseller's own business document).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quotations',
  'quotations',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;

create policy quotations_bucket_insert_own on storage.objects
  for insert with check (
    bucket_id = 'quotations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy quotations_bucket_select on storage.objects
  for select using (
    bucket_id = 'quotations'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

create policy quotations_bucket_delete_own on storage.objects
  for delete using (
    bucket_id = 'quotations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
