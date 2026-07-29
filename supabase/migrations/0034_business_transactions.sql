-- General business bookkeeping entries for a reseller (separate from the
-- per-customer khata in 0033_customer_directory.sql): Sales, Purchases, and
-- Expenses that aren't tied to a specific saved customer -- e.g. cash sales,
-- buying stock from a vendor, or a business expense like rent or wages.
-- Additive only. Safe to run once against the existing schema.

create type business_transaction_type as enum ('sale', 'purchase', 'expense');

create table if not exists business_transactions (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references profiles(id),
  type business_transaction_type not null,
  amount numeric not null check (amount > 0),
  note text,
  party_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_transactions_reseller_idx on business_transactions(reseller_id, type, created_at);

alter table business_transactions enable row level security;

create policy business_transactions_all_reseller on business_transactions
  for all using (reseller_id = auth.uid())
  with check (reseller_id = auth.uid());

create policy business_transactions_admin_all on business_transactions
  for all using (is_admin()) with check (is_admin());
