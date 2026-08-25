-- Quick Payment (Payment In/Out) never captured a real transaction date
-- (only created_at, which is "when it was entered in the app", not
-- necessarily the actual payment date) or a receipt/payment number -
-- both needed for real bookkeeping. Backfill entry_date from created_at
-- for existing rows so nothing is left blank.
-- Additive only. Safe to run once against the existing schema.

alter table customer_ledger_entries add column if not exists entry_date date;
alter table customer_ledger_entries add column if not exists receipt_no text;

update customer_ledger_entries
set entry_date = created_at::date
where entry_date is null;
