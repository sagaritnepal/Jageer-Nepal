-- An installation charge on a Sale bill: a service the customer is charged for on top of
-- the goods, recorded as direct income - it has no item, no stock and no purchase cost
-- behind it. It is kept apart from the items (and from the discount and VAT) so reports can
-- show it on its own; the bill's `amount` already includes it, so the customer's ledger
-- debt and every total that reads `amount` follow without any other change.
-- Additive only. Safe to run more than once.

alter table business_transactions
  add column if not exists installation_charge numeric not null default 0;
