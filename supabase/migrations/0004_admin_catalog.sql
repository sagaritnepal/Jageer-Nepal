-- Admin-only catalog: service categories become a managed table, and new
-- product listings require admin. Sellers keep update rights on products
-- they already list (needed for stock/price changes during order fulfillment).
-- Additive only. Safe to run once against the existing schema.

create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table service_categories enable row level security;

create policy service_categories_select_all on service_categories
  for select using (true);

create policy service_categories_write_admin on service_categories
  for all using (is_admin()) with check (is_admin());

-- Seed with the categories already live in the app.
insert into service_categories (label, description, icon, sort_order) values
  ('Hardware & Installation', 'Repairs & setup', '📦', 1),
  ('Network Issues', 'Wifi & routers', '📍', 2),
  ('Website & App Design', 'Build or fix a site', '🧩', 3),
  ('Digital Marketing', 'SEO, ads & social', '⭐', 4),
  ('Cybersecurity', 'Audits & protection', '🛡️', 5),
  ('Cloud Solutions', 'Storage & backup', '☁️', 6)
on conflict (label) do nothing;

-- Products: restrict new listings to admin; sellers keep update rights on
-- their existing products (stock/price changes during order fulfillment).
drop policy if exists products_write_own on products;

create policy products_insert_admin on products
  for insert with check (is_admin());

create policy products_update_own_or_admin on products
  for update using (seller_id = auth.uid() or is_admin())
  with check (seller_id = auth.uid() or is_admin());

create policy products_delete_admin on products
  for delete using (is_admin());
