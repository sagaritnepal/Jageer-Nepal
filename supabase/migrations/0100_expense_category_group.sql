-- 0100: an expense head can be marked Direct (a cost of goods or jobs: taken off before gross profit) or
-- Indirect. Left empty, the Profit & Loss guesses from the name (freight, repair, labour ...).
alter table public.expense_categories
  add column if not exists expense_group text
  check (expense_group in ('direct', 'indirect'));
