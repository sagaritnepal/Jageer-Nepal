-- Customer must approve the reseller's price quote before a technician gets
-- assigned. Adds two states to the request lifecycle between "pending" and
-- "assigned":
--   quoted   - reseller priced the job, waiting on the customer
--   approved - customer confirmed the price, waiting on the reseller to
--              pick a technician
-- No RLS changes needed: the existing service_requests_update policy already
-- lets the client update their own row (covers approve/decline) and lets the
-- reseller update once reseller_id = auth.uid() (covers picking a
-- technician), since reseller_id is now set at quote time instead of
-- assignment time.

alter type request_status add value if not exists 'quoted';
alter type request_status add value if not exists 'approved';
