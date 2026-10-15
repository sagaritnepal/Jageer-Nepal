-- 0101: Cash is the account every entry without a bank account belongs to, so it can never be a row of
-- bank_accounts. Its label and details (bank, holder, address ...) are kept on the owner's profile instead,
-- so the Bank Accounts page can show and edit it like any other account.
alter table public.profiles add column if not exists cash_account jsonb;
