-- A payment made to a vendor can now record which account it left from,
-- same as customer_ledger_entries (0045) and business_transactions (0043) -
-- needed so Available Balance can be broken down accurately per account.
alter table vendor_ledger_entries add column if not exists bank_account_id uuid references bank_accounts(id) on delete set null;
