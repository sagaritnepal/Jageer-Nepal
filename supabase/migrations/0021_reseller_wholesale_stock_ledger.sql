-- Ties reseller listings to real wholesale purchases: a reseller can only
-- list as much stock in the Marketplace as they've actually bought from a
-- wholesaler. `purchased_stock` is a running total of units bought, credited
-- automatically the moment a wholesaler marks the order delivered - physical
-- receipt, deliberately later than the wholesaler's own stock decrement
-- (which already happens earlier, at pending -> confirmed, per
-- OrderDetailScreen's "confirming is the seller's commitment" comment) since
-- a reseller shouldn't be able to list stock they haven't actually received
-- yet. `purchase_price` tracks the latest unit price paid, shown alongside it.
-- Additive only. Safe to run once against the existing schema.

alter table products add column if not exists purchased_stock integer not null default 0;
alter table products add column if not exists purchase_price numeric;

-- Server-side enforcement: a reseller's stock_level can never exceed what
-- they've actually purchased. purchased_stock itself can only move when this
-- trigger is invoked from within another trigger (pg_trigger_depth() > 0,
-- i.e. by credit_reseller_wholesale_purchase() below) - a direct client
-- UPDATE/INSERT (depth 0) has any attempted change to purchased_stock
-- silently reverted, so a reseller can't just set both columns to whatever
-- they want in one call.
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

  if NEW.seller_role = 'reseller' and NEW.stock_level > NEW.purchased_stock then
    raise exception 'Cannot list % units - only % purchased from wholesale', NEW.stock_level, NEW.purchased_stock;
  end if;

  return NEW;
end;
$$;

drop trigger if exists products_stock_ledger_guard on products;
create trigger products_stock_ledger_guard
  before insert or update on products
  for each row execute function products_guard_stock_ledger();

-- Credits the buyer's (reseller's) purchased_stock when a wholesaler marks
-- the order delivered. Runs as SECURITY DEFINER because it writes to the
-- buyer's product row, not the caller's own - a cross-account write that
-- products_insert_seller_from_catalog / products_update_own_or_admin
-- (correctly) forbid for a normal client call.
create or replace function credit_reseller_wholesale_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  wholesale_product record;
begin
  if not (OLD.status is distinct from 'delivered' and NEW.status = 'delivered') then
    return NEW;
  end if;

  -- Only the seller's own delivery confirmation counts - guards against a
  -- buyer forging their own order forward to fabricate a purchase credit,
  -- even if the orders table's own RLS would otherwise allow the buyer to
  -- update it.
  if auth.uid() is distinct from OLD.seller_id and not is_admin() then
    return NEW;
  end if;

  for item in select * from order_items where order_id = NEW.id loop
    select * into wholesale_product from products where id = item.product_id;
    if wholesale_product is null
       or wholesale_product.seller_role <> 'wholesaler'
       or wholesale_product.catalog_id is null then
      continue;
    end if;

    insert into products (
      seller_id, seller_role, catalog_id, name, description, category, image_url,
      price, stock_level, purchased_stock, purchase_price
    )
    select
      NEW.buyer_id, 'reseller', wholesale_product.catalog_id, cp.name, cp.description,
      cp.category, cp.image_url, 0, 0, item.quantity, item.unit_price
    from catalog_products cp where cp.id = wholesale_product.catalog_id
    on conflict (seller_id, catalog_id) do update
      set purchased_stock = products.purchased_stock + excluded.purchased_stock,
          purchase_price = excluded.purchase_price;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists orders_credit_reseller_purchase on orders;
create trigger orders_credit_reseller_purchase
  after update on orders
  for each row execute function credit_reseller_wholesale_purchase();
