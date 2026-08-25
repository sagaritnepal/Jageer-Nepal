-- Reworks Sale/Purchase into proper accrual bookkeeping: recording a Sale or
-- Purchase against a real customer/vendor now always logs it as a debt on
-- that party's ledger (a customer owes for what they bought; the business
-- owes the vendor for what it bought) - actually receiving or paying the
-- money is a separate, later step through Payment In/Out or a vendor
-- payment. This is what a reseller naturally reaches for ("first sale or
-- purchase, then receive or pay"), and it closes the double-counting hole
-- for good: there is now exactly one place a Sale is billed (the
-- transaction) and exactly one place its cash is recorded (a ledger
-- credit), instead of a reseller having to choose between logging the sale
-- or logging the payment and often doing both.
-- Additive only. Safe to run once against the existing schema.

-- Vendor side: previously only fired for payment_mode = 'credit' (the old
-- "pay later" toggle, now removed from the UI) - every Purchase against a
-- real vendor logs the debt now, regardless of payment_mode.
create or replace function sync_purchase_credit_to_vendor_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from vendor_ledger_entries where source_type = 'business_transaction' and source_id = old.id;
    return old;
  end if;

  if new.type = 'purchase' and new.customer_id is not null and new.amount > 0 then
    insert into vendor_ledger_entries (vendor_id, owner_id, entry_type, amount, note, source, source_type, source_id, entry_date)
    values (new.customer_id, new.owner_id, 'debit', new.amount, new.note, 'booking', 'business_transaction', new.id, new.bill_date)
    on conflict (source_type, source_id) where source_type is not null and source_id is not null
    do update set amount = excluded.amount, vendor_id = excluded.vendor_id, note = excluded.note, entry_date = excluded.entry_date;
  else
    delete from vendor_ledger_entries where source_type = 'business_transaction' and source_id = new.id;
  end if;

  return new;
end;
$$;

-- Customer side: the same idea, new - a Sale against a real customer logs
-- what they now owe for it.
create or replace function sync_sale_to_customer_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from customer_ledger_entries where source_type = 'business_transaction' and source_id = old.id;
    return old;
  end if;

  if new.type = 'sale' and new.customer_id is not null and new.amount > 0 then
    insert into customer_ledger_entries (customer_id, owner_id, entry_type, amount, note, source, source_type, source_id, entry_date)
    values (new.customer_id, new.owner_id, 'debit', new.amount, new.note, 'booking', 'business_transaction', new.id, new.bill_date)
    on conflict (source_type, source_id) where source_type is not null and source_id is not null
    do update set amount = excluded.amount, customer_id = excluded.customer_id, note = excluded.note, entry_date = excluded.entry_date;
  else
    delete from customer_ledger_entries where source_type = 'business_transaction' and source_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists business_transactions_sync_customer_ledger on business_transactions;
create trigger business_transactions_sync_customer_ledger
  after insert or update or delete on business_transactions
  for each row execute function sync_sale_to_customer_ledger();

-- Backfill: any existing Sale/Purchase already linked to a real party gets
-- its matching debt logged now, same as new ones will be from here on.
update business_transactions set updated_at = updated_at where type in ('sale', 'purchase') and customer_id is not null;
