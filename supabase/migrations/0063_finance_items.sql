-- A name typed into Sale/Purchase's "Pick from your stock" item picker that
-- isn't in the reseller's actual product catalog used to just vanish after
-- being added to that one bill - nowhere to search it up again next time.
-- Inserting it straight into `products` isn't right either: that table is
-- the real, cross-app marketplace catalog, and a reseller/wholesaler is only
-- allowed to add a row there by stocking an admin-approved catalog item
-- (products_insert_seller_from_catalog, 0015_product_catalog.sql) - not by
-- typing an arbitrary name while billing. This is a separate, lightweight,
-- Finance-only memory of names (and their last-used rate) so the item
-- picker can offer them again, without touching the real catalog at all.
-- Additive only. Safe to run once against the existing schema.

create table if not exists finance_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  rate numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plain (not lower()) column pair, deliberately - upserting by name (so
-- retyping the same item across many bills updates its rate instead of
-- erroring on a duplicate) needs a unique index PostgREST's on_conflict can
-- reference directly by column name, which an expression index can't do.
create unique index if not exists finance_items_owner_name_idx
  on finance_items (owner_id, name);

alter table finance_items enable row level security;

create policy finance_items_all_owner on finance_items
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy finance_items_admin_all on finance_items
  for all using (is_admin()) with check (is_admin());
