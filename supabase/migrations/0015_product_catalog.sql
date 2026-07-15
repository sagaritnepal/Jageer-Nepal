-- Admin-managed catalog of product templates (name/description/category/
-- image - no price, since price is always seller-specific). Wholesalers and
-- resellers can now self-service "stock" any catalog item under their own
-- products row instead of asking admin to hand-type a duplicate listing per
-- seller.
-- Additive only. Safe to run once against the existing schema.

create table if not exists catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  category text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table catalog_products enable row level security;

create policy catalog_products_select_all on catalog_products
  for select using (true);

create policy catalog_products_write_admin on catalog_products
  for all using (is_admin()) with check (is_admin());

-- products: link each seller-owned listing back to the catalog template it
-- was stocked from (nullable - existing admin-created rows predate the
-- catalog and keep working exactly as they are), and record which role owns
-- the row so client-side filtering / RLS never has to join back to profiles.
alter table products add column if not exists catalog_id uuid references catalog_products(id);
alter table products add column if not exists seller_role user_role;

-- Backfill seller_role for every existing row from the seller's actual
-- profile - deliberately NOT from current_role(), which would reflect this
-- migration's own session (run via a direct DB connection, no authenticated
-- user) rather than each row's real seller.
update products set seller_role = profiles.role
from profiles
where profiles.id = products.seller_id
  and products.seller_role is null;

alter table products alter column seller_role set not null;

-- New rows default to the inserting user's own live role, computed
-- server-side, so the app never needs to (and can't be trusted to) pass this
-- explicitly.
alter table products alter column seller_role set default "current_role"();

-- One listing per seller per catalog item - lets the stocking screens use a
-- single upsert instead of a check-then-insert-or-update dance. Legacy rows
-- (catalog_id null) never collide here: Postgres treats every NULL as
-- distinct from every other NULL in a unique index.
create unique index if not exists products_seller_catalog_key on products(seller_id, catalog_id);

-- Resellers/wholesalers can now create their own listing, but only by
-- stocking an active catalog item under their own id and their own real
-- role. This is additive - it combines with the existing
-- products_insert_admin policy (0004_admin_catalog.sql), which still lets
-- admin insert any row, catalog-linked or not.
create policy products_insert_seller_from_catalog on products
  for insert with check (
    seller_id = auth.uid()
    and seller_role = "current_role"()
    and "current_role"() = any (array['reseller', 'wholesaler']::user_role[])
    and catalog_id is not null
    and exists (
      select 1 from catalog_products cp
      where cp.id = products.catalog_id and cp.is_active
    )
  );

-- No update-policy change needed: the existing products_update_own_or_admin
-- policy (seller_id = auth.uid() or is_admin()) already lets a seller edit
-- their own row's price/stock_level, which is all the +/- stepper screens do.
