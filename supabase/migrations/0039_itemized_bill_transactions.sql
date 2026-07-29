-- Lets a Sale or Purchase transaction be entered as a proper itemized bill
-- (date, bill no, party name/address, VAT/PAN no, line items with qty and
-- rate, an optional discount/VAT adjustment, and a grand total) instead of
-- just a single lump amount. Expense entries keep using the plain amount
-- form -- these columns are simply left null/empty for those rows.
-- `amount` keeps meaning what it always has (the transaction's total value,
-- used everywhere else in Finance) and now equals the bill's grand total.
-- Additive only. Safe to run once against the existing schema.

alter table business_transactions add column if not exists bill_no text;
alter table business_transactions add column if not exists bill_date date;
alter table business_transactions add column if not exists party_address text;
alter table business_transactions add column if not exists vat_pan_no text;
alter table business_transactions add column if not exists items jsonb not null default '[]'::jsonb;
alter table business_transactions add column if not exists discount_amount numeric not null default 0;
alter table business_transactions add column if not exists vat_amount numeric not null default 0;
