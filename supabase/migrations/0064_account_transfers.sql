-- Moving money between your own accounts (e.g. withdrawing cash from a bank,
-- or moving Esewa funds into a bank account) isn't a Sale, Purchase,
-- Expense, or a customer/vendor payment - nothing was earned or spent, it
-- just changed which account it sits in. This is its own record so it can
-- move each account's balance (out of one, into the other) without ever
-- touching Total Received/Paid, Sales, Purchase, or Expense, which should
-- only ever reflect real business activity.
-- Additive only. Safe to run once against the existing schema.

create table if not exists account_transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  -- null = Cash, matching the same convention business_transactions and the
  -- ledger tables already use for bank_account_id.
  from_account_id uuid references bank_accounts(id) on delete set null,
  to_account_id uuid references bank_accounts(id) on delete set null,
  amount numeric not null check (amount > 0),
  note text,
  transfer_date date not null,
  created_at timestamptz not null default now(),
  constraint account_transfers_different_accounts check (from_account_id is distinct from to_account_id)
);

create index if not exists account_transfers_owner_idx on account_transfers(owner_id, transfer_date);

alter table account_transfers enable row level security;

create policy account_transfers_all_owner on account_transfers
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy account_transfers_admin_all on account_transfers
  for all using (is_admin()) with check (is_admin());
