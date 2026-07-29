-- Reseller-owned customer directory ("My Customers" / Finance portal): a
-- saved address book of a reseller's own business contacts (name, phone,
-- address + GPS), independent of the phone's contacts app, that can be
-- picked from (or added/edited inline) when creating a service/product
-- request. Each customer also gets a running ledger ("khata") of what they
-- owe or have paid -- entries are added either manually by the reseller or
-- automatically whenever a priced job is booked for them.
-- Additive only. Safe to run once against the existing schema.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references profiles(id),
  name text not null,
  phone text,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_reseller_idx on customers(reseller_id, name);

alter table customers enable row level security;

create policy customers_all_reseller on customers
  for all using (reseller_id = auth.uid())
  with check (reseller_id = auth.uid());

create policy customers_admin_all on customers
  for all using (is_admin()) with check (is_admin());

-- Ledger entries: 'debit' = customer owes more (a priced job, or a manual
-- credit sale), 'credit' = a payment received from the customer.
create table if not exists customer_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  reseller_id uuid not null references profiles(id),
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount numeric not null check (amount > 0),
  note text,
  source text not null default 'manual' check (source in ('manual', 'booking')),
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists customer_ledger_entries_customer_idx on customer_ledger_entries(customer_id, created_at);

-- Lets the booking-sync trigger below upsert one ledger entry per booking
-- instead of piling up a new row every time a price is edited.
create unique index if not exists customer_ledger_entries_source_idx
  on customer_ledger_entries (source_type, source_id)
  where source_type is not null and source_id is not null;

alter table customer_ledger_entries enable row level security;

create policy customer_ledger_entries_select on customer_ledger_entries
  for select using (reseller_id = auth.uid());

-- Resellers can only hand-add/edit/remove their own *manual* entries --
-- booking-sourced rows are only ever written by the trigger below (which
-- runs as security definer), so they stay in sync with the request itself.
create policy customer_ledger_entries_insert_manual on customer_ledger_entries
  for insert with check (reseller_id = auth.uid() and source = 'manual');

create policy customer_ledger_entries_update_manual on customer_ledger_entries
  for update using (reseller_id = auth.uid() and source = 'manual')
  with check (reseller_id = auth.uid() and source = 'manual');

create policy customer_ledger_entries_delete_manual on customer_ledger_entries
  for delete using (reseller_id = auth.uid() and source = 'manual');

create policy customer_ledger_entries_admin_all on customer_ledger_entries
  for all using (is_admin()) with check (is_admin());

-- Link a service request to a saved customer (optional -- walk-in jobs with
-- no saved customer keep using the plain customer_name/customer_phone text
-- fields from 0008_reseller_customer_contact.sql).
alter table service_requests add column if not exists customer_id uuid references customers(id);
create index if not exists service_requests_customer_idx on service_requests(customer_id);

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

  insert into customer_ledger_entries (customer_id, reseller_id, entry_type, amount, note, source, source_type, source_id)
  values (new.customer_id, new.reseller_id, 'debit', new.quoted_price, new.issue_type, 'booking', 'service_request', new.id)
  on conflict (source_type, source_id)
  do update set amount = excluded.amount, customer_id = excluded.customer_id, note = excluded.note;

  return new;
end;
$$;

drop trigger if exists service_requests_sync_ledger on service_requests;
create trigger service_requests_sync_ledger
  after insert or update of customer_id, quoted_price, status on service_requests
  for each row execute function sync_service_request_ledger();
