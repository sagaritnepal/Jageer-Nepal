-- Track whether a sale/purchase/expense moved cash-in-hand or a bank
-- account, so Cash and Bank can be shown as separate running balances.
alter table business_transactions add column if not exists payment_mode text not null default 'cash';
alter table business_transactions drop constraint if exists business_transactions_payment_mode_check;
alter table business_transactions add constraint business_transactions_payment_mode_check
  check (payment_mode in ('cash', 'bank'));
