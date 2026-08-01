-- A reseller/wholesaler buying stock through "Buy From Wholesaler" checkout
-- never showed up in their own Finance tab - the order flow (orders/
-- order_items) and the Finance flow (business_transactions) were entirely
-- separate, so a delivered wholesale purchase had to be re-typed by hand as
-- a Purchase transaction to appear in Finance at all. This mirrors
-- 0028's stock-crediting trigger (same "who can flip it to delivered"
-- guard) but writes a purchase business_transaction for the buyer instead.

create or replace function sync_order_to_finance_purchase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_name text;
  item_rows jsonb;
begin
  if not (OLD.status is distinct from 'delivered' and NEW.status = 'delivered') then
    return NEW;
  end if;

  if auth.uid() is distinct from OLD.seller_id and not is_admin() then
    return NEW;
  end if;

  select full_name into seller_name from profiles where id = NEW.seller_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'description', coalesce(p.name, 'Item'),
    'qty', oi.quantity,
    'rate', oi.unit_price,
    'amount', oi.quantity * oi.unit_price
  )), '[]'::jsonb)
  into item_rows
  from order_items oi
  left join products p on p.id = oi.product_id
  where oi.order_id = NEW.id;

  insert into business_transactions (
    owner_id, type, amount, party_name, source_type, source_id, items, bill_date, payment_mode
  )
  values (
    NEW.buyer_id, 'purchase', NEW.total_amount, seller_name, 'order', NEW.id, item_rows, NEW.created_at::date, 'cash'
  )
  on conflict (source_type, source_id) where source_type is not null and source_id is not null
  do update set amount = excluded.amount, items = excluded.items, party_name = excluded.party_name;

  return NEW;
end;
$$;

drop trigger if exists orders_sync_finance_purchase on orders;
create trigger orders_sync_finance_purchase
  after update of status on orders
  for each row execute function sync_order_to_finance_purchase();

-- Backfill: any order already delivered before this migration existed.
insert into business_transactions (owner_id, type, amount, party_name, source_type, source_id, items, bill_date, payment_mode)
select
  o.buyer_id, 'purchase', o.total_amount, prof.full_name, 'order', o.id,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'description', coalesce(p.name, 'Item'), 'qty', oi.quantity, 'rate', oi.unit_price, 'amount', oi.quantity * oi.unit_price
    ))
    from order_items oi
    left join products p on p.id = oi.product_id
    where oi.order_id = o.id
  ), '[]'::jsonb),
  o.created_at::date, 'cash'
from orders o
left join profiles prof on prof.id = o.seller_id
where o.status = 'delivered'
on conflict (source_type, source_id) where source_type is not null and source_id is not null do nothing;
