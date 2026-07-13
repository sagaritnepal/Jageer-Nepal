-- Only requests that came in through the client app need the customer to
-- approve a price before a technician is assigned. When a reseller brings
-- in their own (offline) customer, they've already agreed on the job and
-- price directly, so there's nothing for the app-side customer to approve -
-- the reseller can price and assign a technician in one step.
--
-- This also lets a reseller see how much of their business is app-sourced
-- vs their own existing customer base.

alter table service_requests add column if not exists origin text not null default 'app'
  check (origin in ('app', 'reseller'));

-- Backfill: rows with customer contact info were only ever created through
-- the reseller's own intake form, not the client app.
update service_requests set origin = 'reseller' where customer_name is not null;
