-- Adds a chalan_urls column to service_requests: a photographed paper chalan
-- (delivery/completion slip) the assigned technician attaches to a job.
-- Reuses the existing request-photos bucket and its RLS (folder-per-uploader
-- insert, cross-role read for reseller/wholesaler/technician/admin - see
-- 0005_request_details.sql) and the existing service_requests_update policy
-- (technician_id = auth.uid() can already update any column on their own
-- assigned request) - no new policies needed.
-- Additive only. Safe to run once against the existing schema.

alter table service_requests add column if not exists chalan_urls text[] not null default '{}';
