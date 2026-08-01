-- Payment In/Out entries (customer_ledger_entries) can now record which
-- account received/paid the money too, same as business_transactions.
alter table customer_ledger_entries add column if not exists bank_account_id uuid references bank_accounts(id) on delete set null;
