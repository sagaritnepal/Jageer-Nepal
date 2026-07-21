-- Previously, crediting a reseller's purchased_stock (see
-- credit_reseller_wholesale_purchase in 0021) left stock_level at 0 on first
-- purchase, requiring the reseller to manually re-enter the quantity they
-- just bought before it counted as real, listable inventory - in practice
-- this meant a delivered wholesale order showed no visible stock at all,
-- reported as "purchased stock not showing up".
--
-- Now stock_level moves in lockstep with purchased_stock on every credit:
-- first purchase seeds stock_level at the full quantity bought, and repeat
-- purchases add the new quantity to whatever stock_level currently is
-- (not to purchased_stock), so a reseller who already sold some units down
-- doesn't have that stock silently topped back up by an unrelated new
-- purchase. The products_guard_stock_ledger trigger (0027) still enforces
-- stock_level <= purchased_stock at all times.
--
-- Retail price is still left at the seller's discretion (not auto-set) -
-- a listing only becomes customer-visible once they set a price, per
-- MyStorefront's `Number(p.price) > 0` check.

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
      cp.category, cp.image_url, 0, item.quantity, item.quantity, item.unit_price
    from catalog_products cp where cp.id = wholesale_product.catalog_id
    on conflict (seller_id, catalog_id) do update
      set stock_level = products.stock_level + excluded.purchased_stock,
          purchased_stock = products.purchased_stock + excluded.purchased_stock,
          purchase_price = excluded.purchase_price;
  end loop;

  return NEW;
end;
$$;
