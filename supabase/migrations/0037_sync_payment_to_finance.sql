-- Reflects a resolved job's payment into the reseller's Finance portal the
-- moment payment_status flips to 'paid' -- a 'credit' ledger entry if the
-- job is linked to a saved customer (0033_customer_directory.sql already
-- logs the matching 'debit' when the job is priced), or a 'sale'
-- business_transaction if it's a walk-in job with no saved customer record.
-- One trigger covers both the manual cash "mark as paid" flow and the
-- automatic Fonepay online flow, since both just update payment_status.
-- Additive only. Safe to run once against the existing schema.

alter table business_transactions add column if not exists source_type text;
alter table business_transactions add column if not exists source_id uuid;

create unique index if not exists business_transactions_source_idx
  on business_transactions (source_type, source_id)
  where source_type is not null and source_id is not null;

create or replace function sync_service_request_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  paid_amount numeric;
  job_total numeric;
begin
  if new.payment_status = 'paid' and (old.payment_status is distinct from 'paid') then
    -- A job_card total of 0 means the technician never filled in real costs
    -- (defaults to 0) -- fall back to the quoted price rather than logging
    -- a payment of NPR 0.
    select coalesce(labor_cost, 0) + coalesce(parts_cost, 0) into job_total
    from job_cards where service_request_id = new.id limit 1;

    paid_amount := case when job_total is not null and job_total > 0 then job_total else new.quoted_price end;
    if paid_amount is null or paid_amount <= 0 or new.reseller_id is null then
      return new;
    end if;

    if new.customer_id is not null then
      insert into customer_ledger_entries (customer_id, owner_id, entry_type, amount, note, source, source_type, source_id)
      values (new.customer_id, new.reseller_id, 'credit', paid_amount, new.issue_type, 'booking', 'service_request_payment', new.id)
      on conflict (source_type, source_id) where source_type is not null and source_id is not null
      do update set amount = excluded.amount;
    else
      insert into business_transactions (owner_id, type, amount, note, party_name, source_type, source_id)
      values (new.reseller_id, 'sale', paid_amount, new.issue_type, new.customer_name, 'service_request_payment', new.id)
      on conflict (source_type, source_id) where source_type is not null and source_id is not null
      do update set amount = excluded.amount;
    end if;
  elsif new.payment_status <> 'paid' and old.payment_status = 'paid' then
    delete from customer_ledger_entries where source_type = 'service_request_payment' and source_id = new.id;
    delete from business_transactions where source_type = 'service_request_payment' and source_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists service_requests_sync_payment on service_requests;
create trigger service_requests_sync_payment
  after update of payment_status on service_requests
  for each row execute function sync_service_request_payment();

-- Backfill: sync any job already marked paid before this trigger existed.
-- ("after update of x" only fires when an UPDATE statement targets that
-- column, not when the value actually changes -- so re-saving payment_status
-- on already-paid rows wouldn't reach the trigger's changed-value guard.
-- Insert directly instead, using the same amount/branch logic.)
insert into customer_ledger_entries (customer_id, owner_id, entry_type, amount, note, source, source_type, source_id)
select
  sr.customer_id, sr.reseller_id, 'credit',
  case when coalesce(jc.total, 0) > 0 then jc.total else sr.quoted_price end,
  sr.issue_type, 'booking', 'service_request_payment', sr.id
from service_requests sr
left join lateral (
  select coalesce(labor_cost, 0) + coalesce(parts_cost, 0) as total
  from job_cards where service_request_id = sr.id limit 1
) jc on true
where sr.payment_status = 'paid'
  and sr.customer_id is not null
  and sr.reseller_id is not null
  and (case when coalesce(jc.total, 0) > 0 then jc.total else sr.quoted_price end) > 0
on conflict (source_type, source_id) where source_type is not null and source_id is not null do nothing;

insert into business_transactions (owner_id, type, amount, note, party_name, source_type, source_id)
select
  sr.reseller_id, 'sale',
  case when coalesce(jc.total, 0) > 0 then jc.total else sr.quoted_price end,
  sr.issue_type, sr.customer_name, 'service_request_payment', sr.id
from service_requests sr
left join lateral (
  select coalesce(labor_cost, 0) + coalesce(parts_cost, 0) as total
  from job_cards where service_request_id = sr.id limit 1
) jc on true
where sr.payment_status = 'paid'
  and sr.customer_id is null
  and sr.reseller_id is not null
  and (case when coalesce(jc.total, 0) > 0 then jc.total else sr.quoted_price end) > 0
on conflict (source_type, source_id) where source_type is not null and source_id is not null do nothing;
