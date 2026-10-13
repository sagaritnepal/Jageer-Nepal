-- A bill created from a completed job ("Create bill" on the Requests page): a Sale saved with
-- source_type = 'service_request_bill' and source_id = the job. It moves the job from Completed
-- to Awaiting payment.
--
-- The job already put what the customer owes on their ledger when it was completed, so this
-- bill must not add a second debit: the ledger sync for sales now skips a bill that comes from
-- a job. Everything else about the sync is as in 0061.
-- Safe to run more than once.

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

  if new.type = 'sale' and new.customer_id is not null and new.amount > 0
     and coalesce(new.source_type, '') <> 'service_request_bill' then
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
