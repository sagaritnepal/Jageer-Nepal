-- A managed list of expense categories per reseller/wholesaler (Rent,
-- Fuel, Staff Salary, etc.) so an Expense entry can be tagged consistently
-- instead of a free-text note, plus one shared "date of this transaction"
-- column (bill_date from 0039 already covers Sale/Purchase bills; Expense
-- entries now use the same column for their date field).
-- Additive only. Safe to run once against the existing schema.

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_categories_owner_name_idx
  on expense_categories (owner_id, lower(name));

alter table expense_categories enable row level security;

create policy expense_categories_all_owner on expense_categories
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy expense_categories_admin_all on expense_categories
  for all using (is_admin()) with check (is_admin());

alter table business_transactions add column if not exists expense_category_id uuid references expense_categories(id);
