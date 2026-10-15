-- 0095: an expense head is Direct (a cost of goods or jobs: shown above gross profit) or Indirect.
alter table public.expense_categories
  add column if not exists expense_group text not null default 'indirect'
  check (expense_group in ('direct', 'indirect'));
