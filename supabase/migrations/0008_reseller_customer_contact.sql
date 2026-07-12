-- Resellers often take these requests over a phone call from an existing
-- customer who has no account in the app. Record who the job is actually
-- for so the technician (and other resellers) can reach them.

alter table service_requests add column if not exists customer_name text;
alter table service_requests add column if not exists customer_phone text;
