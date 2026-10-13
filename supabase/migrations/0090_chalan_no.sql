-- The chalan (delivery / completion slip) number a technician writes down when they finish a
-- job. The app asks for it, together with a photo of the slip (chalan_urls, migration 0066),
-- before it lets the job be marked complete.
-- Additive only. Safe to run more than once.

alter table service_requests add column if not exists chalan_no text;
