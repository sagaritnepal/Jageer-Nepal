-- Lets a wholesaler submit a brand-new catalog item (not already in the
-- admin-curated catalog) with their own price/stock attached. It lands as an
-- inactive catalog_products row - invisible everywhere a normal catalog item
-- would show - until an admin approves it via the existing "Show" toggle in
-- app/(admin)/catalog.tsx. On approval, a trigger auto-creates the
-- wholesaler's products row from the price/stock they originally submitted,
-- so they don't have to re-enter it.
-- Additive only. Safe to run once against the existing schema.

alter table catalog_products add column if not exists submitted_by uuid references profiles(id);
alter table catalog_products add column if not exists pending_price numeric;
alter table catalog_products add column if not exists pending_stock integer;

-- A wholesaler may insert a new catalog item for themselves, but only in the
-- pending (inactive) state - they cannot self-approve by inserting an active
-- row, and cannot submit on someone else's behalf.
create policy catalog_products_insert_wholesaler_pending on catalog_products
  for insert with check (
    "current_role"() = 'wholesaler'
    and submitted_by = auth.uid()
    and is_active = false
  );

-- Runs as the function owner (bypasses RLS) so the auto-created products row
-- doesn't depend on which session (admin, in practice) flipped is_active.
create or replace function activate_submitted_catalog_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active and not old.is_active and new.submitted_by is not null then
    insert into products (
      seller_id, seller_role, catalog_id, name, description, category, image_url, price, stock_level, min_order_qty
    )
    values (
      new.submitted_by, 'wholesaler', new.id, new.name, new.description, new.category, new.image_url,
      coalesce(new.pending_price, 0), coalesce(new.pending_stock, 0), 1
    )
    on conflict (seller_id, catalog_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_products_activate_submission on catalog_products;
create trigger catalog_products_activate_submission
  after update on catalog_products
  for each row
  execute function activate_submitted_catalog_product();
