-- Product listings copy image_url from their catalog template once, at the
-- moment they're stocked (CatalogStockingList's upsert) - a one-time
-- snapshot, not a live reference. So when 0022 added catalog photos after
-- some items were already stocked, those existing listings kept their old
-- (null) image and never picked up the new one - the "picture not syncing"
-- bug. Fixes both directions: backfills every already-stocked listing to
-- match its catalog template right now, and keeps them in sync going
-- forward whenever an admin updates a catalog item's photo.
-- Additive only. Safe to run once against the existing schema.

-- 0021's products_guard_stock_ledger re-validated stock_level <= purchased_stock
-- on every UPDATE, even ones that never touch stock_level - so a legacy
-- listing stocked before the wholesale-purchase-cap existed (stock_level > 0,
-- purchased_stock still 0) blocked any future edit to that row, including
-- this migration's own image backfill below. Only re-check the cap when
-- stock_level is actually part of what's changing (or being inserted).
create or replace function products_guard_stock_ledger()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and NEW.purchased_stock is distinct from OLD.purchased_stock then
    if pg_trigger_depth() = 0 and not is_admin() then
      NEW.purchased_stock := OLD.purchased_stock;
    end if;
  end if;

  if NEW.seller_role = 'reseller'
     and (TG_OP = 'INSERT' or NEW.stock_level is distinct from OLD.stock_level)
     and NEW.stock_level > NEW.purchased_stock then
    raise exception 'Cannot list % units - only % purchased from wholesale', NEW.stock_level, NEW.purchased_stock;
  end if;

  return NEW;
end;
$$;

update products
set image_url = cp.image_url
from catalog_products cp
where products.catalog_id = cp.id
  and products.image_url is distinct from cp.image_url;

-- Only an admin can ever reach this (catalog_products writes are
-- is_admin()-gated per catalog_products_write_admin), and
-- products_update_own_or_admin already lets is_admin() update any seller's
-- row - so this needs no elevated privileges of its own.
create or replace function propagate_catalog_image_to_products()
returns trigger
language plpgsql
as $$
begin
  if NEW.image_url is distinct from OLD.image_url then
    update products set image_url = NEW.image_url where catalog_id = NEW.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists catalog_products_propagate_image on catalog_products;
create trigger catalog_products_propagate_image
  after update on catalog_products
  for each row execute function propagate_catalog_image_to_products();
