-- Bank accounts only ever had a short label (e.g. "Nabil Bank - Current")
-- for picking between them - not enough to actually identify the account
-- for real bookkeeping. Adds the real detail (bank name, account number,
-- holder name, address), all optional since the label alone is still
-- enough to keep using the picker.
-- Additive only. Safe to run once against the existing schema.

alter table bank_accounts add column if not exists bank_name text;
alter table bank_accounts add column if not exists account_number text;
alter table bank_accounts add column if not exists account_holder_name text;
alter table bank_accounts add column if not exists address text;
