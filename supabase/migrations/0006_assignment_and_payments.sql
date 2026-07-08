-- Adds technician availability/location (for nearby + available assignment)
-- and payment tracking on service requests (the client pays the reseller,
-- not the technician directly, so the reseller needs a record of what's
-- been collected).
-- Additive only. Safe to run once against the existing schema.

alter table profiles add column if not exists is_available boolean not null default true;
alter table profiles add column if not exists latitude double precision;
alter table profiles add column if not exists longitude double precision;

alter table service_requests add column if not exists payment_status text not null default 'unpaid'
  check (payment_status in ('unpaid', 'paid'));
alter table service_requests add column if not exists paid_at timestamptz;
