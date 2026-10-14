-- One bill can cover several completed jobs of the same customer / company (their chalans billed
-- together under a single bill number). The bill's own `source_id` keeps pointing at the first job
-- (0091); this lists every job it covers, so each of them moves to Awaiting payment.
-- Additive only. Safe to run more than once.

alter table business_transactions
  add column if not exists source_job_ids uuid[] not null default '{}';
