-- 0033_customer_directory.sql's debit-sync trigger uses
-- "on conflict (source_type, source_id)" against a *partial* unique index
-- (customer_ledger_entries_source_idx) without restating the index's WHERE
-- predicate. Postgres only infers a partial unique index as the ON CONFLICT
-- arbiter when the predicate is repeated in the ON CONFLICT clause itself --
-- without it, the insert fails outright with "no unique or exclusion
-- constraint matching the ON CONFLICT specification" (confirmed live: this
-- has been failing since 0033 shipped, on every service_request insert or
-- update that sets both customer_id and quoted_price -- it just never
-- happened to be exercised, since no service_request currently has both set
-- at once). Same bug pattern this fixed in 0037 for the payment-sync
-- trigger; this migration applies the identical fix to the original
-- debit-sync trigger.
-- Additive only. Safe to run once against the existing schema.

create or replace function sync_service_request_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null or new.quoted_price is null or new.quoted_price <= 0 or new.status = 'cancelled' then
    delete from customer_ledger_entries where source_type = 'service_request' and source_id = new.id;
    return new;
  end if;

  insert into customer_ledger_entries (customer_id, owner_id, entry_type, amount, note, source, source_type, source_id)
  values (new.customer_id, new.reseller_id, 'debit', new.quoted_price, new.issue_type, 'booking', 'service_request', new.id)
  on conflict (source_type, source_id) where source_type is not null and source_id is not null
  do update set amount = excluded.amount, customer_id = excluded.customer_id, note = excluded.note;

  return new;
end;
$$;
