-- Lets a resolved service request be paid by cash (reseller confirms
-- collection manually, as before) or online via a Fonepay dynamic QR code
-- (an Edge Function confirms payment server-side and flips payment_status
-- to 'paid' itself once Fonepay reports success).
-- No RLS changes needed: the existing service_requests_update policy already
-- lets the client and the owning reseller write any column on their own row,
-- and the online-payment confirmation write goes through the Edge Function's
-- service-role client, which bypasses RLS entirely.
-- Additive only. Safe to run once against the existing schema.

alter table service_requests add column if not exists payment_method text
  check (payment_method in ('cash', 'online'));
alter table service_requests add column if not exists fonepay_prn text;

create unique index if not exists service_requests_fonepay_prn_idx
  on service_requests (fonepay_prn) where fonepay_prn is not null;
