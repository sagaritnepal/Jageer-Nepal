-- Tracks which rows of a bank/wallet statement (eSewa, etc.) have already
-- been turned into a real Finance entry (a business_transactions expense or
-- a customer_ledger_entries payment), keyed by the statement's own unique
-- "Reference Code". Re-importing the same statement, or one with an
-- overlapping date range, must skip rows already recorded here rather than
-- creating duplicate entries.
-- Additive only. Safe to run once against the existing schema.

create table if not exists statement_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  reference_code text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, reference_code)
);

alter table statement_imports enable row level security;

create policy statement_imports_all_owner on statement_imports
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy statement_imports_admin_all on statement_imports
  for all using (is_admin()) with check (is_admin());
