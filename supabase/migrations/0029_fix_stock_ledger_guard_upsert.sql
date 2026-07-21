-- products_guard_stock_ledger (0027) raised false "Cannot list N units - only
-- 0 purchased from wholesale" errors whenever a reseller tried to save a
-- price/quantity through the Shop > Products upsert
-- (useSupabaseUpsert('products', 'seller_id,catalog_id'), which never sends
-- purchased_stock). For `INSERT ... ON CONFLICT DO UPDATE`, Postgres fires
-- the BEFORE INSERT trigger on the candidate row - with purchased_stock at
-- its column DEFAULT of 0, since it's absent from the payload - *before*
-- checking whether the row conflicts and should be redirected to UPDATE.
-- The unconditional stock_level > purchased_stock check then saw 0 and
-- rejected stock the reseller had already legitimately bought.
--
-- Fix: on INSERT for a reseller row, look up any already-existing row for
-- (seller_id, catalog_id) - the one this upsert is about to conflict into -
-- and use its real purchased_stock for the comparison instead of the
-- about-to-be-discarded default. Falls back to NEW.purchased_stock when no
-- such row exists (a genuinely new row), preserving the original protection.

create or replace function products_guard_stock_ledger()
returns trigger
language plpgsql
as $$
declare
  effective_purchased_stock integer;
begin
  if TG_OP = 'UPDATE' and NEW.purchased_stock is distinct from OLD.purchased_stock then
    if pg_trigger_depth() = 0 and not is_admin() then
      NEW.purchased_stock := OLD.purchased_stock;
    end if;
  end if;

  effective_purchased_stock := NEW.purchased_stock;

  if TG_OP = 'INSERT' and NEW.seller_role = 'reseller' then
    select p.purchased_stock into effective_purchased_stock
    from products p
    where p.seller_id = NEW.seller_id and p.catalog_id = NEW.catalog_id;

    if effective_purchased_stock is null then
      effective_purchased_stock := NEW.purchased_stock;
    end if;
  end if;

  if NEW.seller_role = 'reseller' and NEW.stock_level > effective_purchased_stock then
    raise exception 'Cannot list % units - only % purchased from wholesale', NEW.stock_level, effective_purchased_stock;
  end if;

  return NEW;
end;
$$;
