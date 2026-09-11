-- Payables: what the reseller/wholesaler owes their suppliers, mirroring
-- customer_ledger_entries (0033) but with the opposite polarity - a
-- customer's "debit" means they owe the business more, but a vendor's
-- "debit" means the business owes the vendor more (bought stock on
-- credit); a vendor's "credit" is an actual cash payment the business made
-- to that vendor. Reusing customer_ledger_entries for this would corrupt
-- its documented meaning (e.g. a vendor debt insert as 'credit' would look
-- like money received from a customer and inflate Total Received), so this
-- gets its own table. Vendors are still just rows in the same `customers`
-- directory that Purchase's "Vendor" field already picks from (0035
-- generalized that table beyond just customers) - there's no separate
-- vendor contacts list to maintain.
-- Additive only. Safe to run once against the existing schema.

create table if not exists vendor_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references customers(id) on delete cascade,
  owner_id uuid not null references profiles(id),
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount numeric not null check (amount > 0),
  note text,
  source text not null default 'manual' check (source in ('manual', 'booking')),
  source_type text,
  source_id uuid,
  entry_date date,
  receipt_no text,
  created_at timestamptz not null default now()
);

create index if not exists vendor_ledger_entries_vendor_idx on vendor_ledger_entries(vendor_id, created_at);

create unique index if not exists vendor_ledger_entries_source_idx
  on vendor_ledger_entries (source_type, source_id)
  where source_type is not null and source_id is not null;

alter table vendor_ledger_entries enable row level security;

drop policy if exists vendor_ledger_entries_select on vendor_ledger_entries;
create policy vendor_ledger_entries_select on vendor_ledger_entries
  for select using (owner_id = auth.uid());

drop policy if exists vendor_ledger_entries_insert_manual on vendor_ledger_entries;
create policy vendor_ledger_entries_insert_manual on vendor_ledger_entries
  for insert with check (owner_id = auth.uid() and source = 'manual');

drop policy if exists vendor_ledger_entries_update_manual on vendor_ledger_entries;
create policy vendor_ledger_entries_update_manual on vendor_ledger_entries
  for update using (owner_id = auth.uid() and source = 'manual')
  with check (owner_id = auth.uid() and source = 'manual');

drop policy if exists vendor_ledger_entries_delete_manual on vendor_ledger_entries;
create policy vendor_ledger_entries_delete_manual on vendor_ledger_entries
  for delete using (owner_id = auth.uid() and source = 'manual');

drop policy if exists vendor_ledger_entries_admin_all on vendor_ledger_entries;
create policy vendor_ledger_entries_admin_all on vendor_ledger_entries
  for all using (is_admin()) with check (is_admin());

-- A Purchase can now be marked "credit" (pay the vendor later) instead of
-- always cash/bank - see 0043_payment_mode.sql for the original check.
alter table business_transactions drop constraint if exists business_transactions_payment_mode_check;
alter table business_transactions add constraint business_transactions_payment_mode_check
  check (payment_mode in ('cash', 'bank', 'credit'));

-- Keeps a purchase bought on credit reflected as an owed debt automatically,
-- the same way sync_service_request_payment (0037) keeps a paid job
-- reflected as a customer credit - the reseller shouldn't have to separately
-- log a payable entry for the same purchase (that duplication is exactly
-- what caused Sales to double-count into Total Received/To Give before this
-- migration).
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

  if new.type = 'purchase' and new.payment_mode = 'credit' and new.customer_id is not null and new.amount > 0 then
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

drop trigger if exists business_transactions_sync_vendor_ledger on business_transactions;
create trigger business_transactions_sync_vendor_ledger
  after insert or update or delete on business_transactions
  for each row execute function sync_purchase_credit_to_vendor_ledger();
