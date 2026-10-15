-- Why a job was cancelled: an optional remark the reseller writes in the cancel dialog (Requests >
-- My Jobs / Job in progress, and the job page). It is shown on the cancelled job in the Cancelled
-- tab and on the job page, and to the technician who had the job.
--
-- Additive only. Run once, in the Supabase SQL Editor. Safe to run more than once.

alter table service_requests add column if not exists cancel_reason text;

-- Make the API pick up the new column at once (Supabase usually does this by itself after a change).
notify pgrst, 'reload schema';
