-- Lets a seller pull a stocked item off the market without losing its price/
-- quantity (previously the only way to "unlist" something was to zero out
-- the stock, which throws away how much you actually have on hand).
-- Additive only. Safe to run once against the existing schema.

alter table products add column if not exists is_listed boolean not null default true;
