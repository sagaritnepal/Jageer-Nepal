-- 0049 only credited the buyer's Finance with a Purchase when an order was
-- delivered. Extend the same trigger to also credit the seller's (usually a
-- wholesaler's) Finance with a matching Sale, so a delivered order shows up
-- correctly on both sides instead of just the buyer's.

create or replace function sync_order_to_finance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_name text;
  buyer_name text;
  item_rows jsonb;
begin
  if not (OLD.status is distinct from 'delivered' and NEW.status = 'delivered') then
    return NEW;
  end if;

  if auth.uid() is distinct from OLD.seller_id and not is_admin() then
    return NEW;
  end if;

  select full_name into seller_name from profiles where id = NEW.seller_id;
  select full_name into buyer_name from profiles where id = NEW.buyer_id;

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

  insert into business_transactions (
    owner_id, type, amount, party_name, source_type, source_id, items, bill_date, payment_mode
  )
  values (
    NEW.seller_id, 'sale', coalesce(NEW.seller_payout, NEW.total_amount), buyer_name, 'order_sale', NEW.id, item_rows, NEW.created_at::date, 'cash'
  )
  on conflict (source_type, source_id) where source_type is not null and source_id is not null
  do update set amount = excluded.amount, items = excluded.items, party_name = excluded.party_name;

  return NEW;
end;
$$;

drop trigger if exists orders_sync_finance_purchase on orders;
create trigger orders_sync_finance
  after update of status on orders
  for each row execute function sync_order_to_finance();

drop function if exists sync_order_to_finance_purchase();

-- Backfill: any order already delivered before this migration existed -
-- adds the seller-side Sale (the buyer-side Purchase was already backfilled
-- by 0049).
insert into business_transactions (owner_id, type, amount, party_name, source_type, source_id, items, bill_date, payment_mode)
select
  o.seller_id, 'sale', coalesce(o.seller_payout, o.total_amount), buyer_prof.full_name, 'order_sale', o.id,
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
left join profiles buyer_prof on buyer_prof.id = o.buyer_id
where o.status = 'delivered'
on conflict (source_type, source_id) where source_type is not null and source_id is not null do nothing;
