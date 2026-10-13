-- A Sale bill can carry several service charges (installation, wiring, configuration ...), each with
-- its own name and amount, as a small table above the remarks. They are direct income - no item or
-- stock behind them. `installation_charge` (0088) keeps the total of these so existing reports keep
-- working; this column keeps the lines themselves: [{ "name": "Installation", "amount": 500 }, ...].
-- Additive only. Safe to run more than once.

alter table business_transactions
  add column if not exists service_charges jsonb not null default '[]'::jsonb;
