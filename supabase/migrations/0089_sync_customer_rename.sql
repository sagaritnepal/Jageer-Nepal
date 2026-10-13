-- Renaming a saved customer in the Ledger now carries to their jobs and bills.
-- A job (service_requests.customer_name) and a bill (business_transactions.party_name) keep their
-- own copy of the name, so a rename on the customer used to leave every older job and bill
-- showing the old one. This keeps the copies in step, and fixes the ones already out of step.
-- Safe to run more than once.

create or replace function sync_customer_name_to_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update service_requests set customer_name = new.name
     where customer_id = new.id and customer_name is distinct from new.name;
    update business_transactions set party_name = new.name
     where customer_id = new.id and party_name is distinct from new.name;
  end if;
  return new;
end;
$$;

drop trigger if exists customers_sync_name_to_records on customers;
create trigger customers_sync_name_to_records
  after update of name on customers
  for each row execute function sync_customer_name_to_records();

-- One-off: bring the jobs and bills already out of step into line. The user triggers on
-- service_requests (payments, points, notifications) are switched off for it: fixing a name
-- must not re-send or re-book anything.
alter table service_requests disable trigger user;

update service_requests sr
   set customer_name = c.name
  from customers c
 where sr.customer_id = c.id and sr.customer_name is distinct from c.name;

alter table service_requests enable trigger user;

update business_transactions bt
   set party_name = c.name
  from customers c
 where bt.customer_id = c.id and bt.party_name is distinct from c.name;
