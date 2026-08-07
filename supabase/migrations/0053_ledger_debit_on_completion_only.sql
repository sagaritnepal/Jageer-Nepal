-- sync_service_request_ledger() (0033, fixed in 0038) logged a customer's
-- "debit" (money owed to the reseller) the moment a job was quoted, so
-- Finance's "To Receive" card counted jobs that hadn't been worked on yet,
-- not just ones actually finished. Only log the debit once the job is
-- actually done (status = 'resolved') - it still nets out to zero via
-- sync_service_request_payment()'s credit entry once paid, same as before.
-- Additive only. Safe to run once against the existing schema.

create or replace function sync_service_request_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null or new.quoted_price is null or new.quoted_price <= 0 or new.status <> 'resolved' then
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

-- Clean up debit entries that were logged under the old (quoted-not-done)
-- rule for jobs that still aren't actually finished.
delete from customer_ledger_entries cle
using service_requests sr
where cle.source_type = 'service_request'
  and cle.source_id = sr.id
  and sr.status <> 'resolved';
