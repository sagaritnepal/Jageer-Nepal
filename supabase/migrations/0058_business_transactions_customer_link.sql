-- A Sale in the Transactions form and a Payment In in Quick Payment both
-- capture money from a customer, but had no link between them -- picking the
-- same saved customer on a Sale left it invisible on that customer's page,
-- so resellers logging a sale to a known customer would also log a separate
-- Payment In for the same cash to see it reflected there, double-counting it
-- into Total Received and leaving a phantom "To Give" balance (a credit
-- ledger entry with no matching debit reads as an overpayment).
-- Linking a Sale/Purchase to the real customer/vendor record it was picked
-- from lets it show up directly on that party's page instead, without
-- touching customer_ledger_entries at all (a cash sale paid in full creates
-- no debt, so it shouldn't post any ledger entry).
-- Additive only. Safe to run once against the existing schema.

alter table business_transactions add column if not exists customer_id uuid references customers(id) on delete set null;

create index if not exists business_transactions_customer_idx on business_transactions(customer_id, created_at);
