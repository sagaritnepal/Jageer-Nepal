-- A managed list of bank accounts per reseller/wholesaler (a business may
-- bank with more than one), so the payment-mode picker on a transaction can
-- offer "Cash" plus each named bank account instead of a fixed Cash/Bank
-- toggle. Cash itself isn't a row here - it's a fixed pseudo-option in the
-- picker UI, since there's exactly one of it per business.

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bank_accounts_owner_name_idx
  on bank_accounts (owner_id, lower(name));

alter table bank_accounts enable row level security;

create policy bank_accounts_all_owner on bank_accounts
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy bank_accounts_admin_all on bank_accounts
  for all using (is_admin()) with check (is_admin());

alter table business_transactions add column if not exists bank_account_id uuid references bank_accounts(id) on delete set null;
