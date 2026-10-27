-- Mark a job as done from the reseller's side: for the work that was finished but never completed in
-- the app because the technician (or the reseller's own employee) does not use it.
--
-- Until now only the technician could move a job to complete: the database refuses a reseller's own
-- write of that status (service_requests_guard_update, 0077), so a job whose technician never opens the
-- app stayed "assigned" or "in progress" for ever, and could not be billed or paid.
--
-- mark_job_done() does what the technician's Complete does, on the reseller's say-so:
--   * only the job's reseller (or their supervisor, or an admin) may use it;
--   * only a job that is under way - walk-in and not started, approved, assigned or in progress. A
--     request still waiting for the customer's quote answer is not finished work, and a completed,
--     paid or cancelled job has nothing left to mark;
--   * the job becomes 'resolved'; any hold is cleared (0077); the job's price posts on the customer's
--     ledger, the reward points are given and a customer who asked for it through the app is told "Your
--     job is complete" - all by the triggers that already run when a job resolves;
--   * the technician's job card gets its finish time (a card is made if there was none), so the job
--     shows when it ended. A start time is only there if the technician started it in the app.
--
-- NOT required: the chalan number and photo (0096). That rule keeps a technician in the app from
-- completing a job without it; here nobody in the app did the work. The chalan can be added afterwards
-- on the completed job ("Add chalan"), where it is shown as usual.
--
-- Run once, in the Supabase SQL Editor. Safe to run more than once.

create or replace function mark_job_done(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
  card_id uuid;
  customer uuid;
begin
  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  -- coalesce: a job with no reseller makes the comparison NULL, which must read as "no".
  if not (
    coalesce(req.reseller_id = auth.uid(), false)
    or (req.reseller_id is not null and is_supervisor_for(req.reseller_id))
    or is_admin()
  ) then
    raise exception 'Only the reseller who owns this job can mark it as done';
  end if;

  if req.status = 'resolved' then
    raise exception 'This job is already complete';
  end if;
  if req.status = 'cancelled' then
    raise exception 'This job was cancelled, so it cannot be marked as done';
  end if;
  if req.status not in ('pending', 'approved', 'assigned', 'in_progress')
     or (req.status = 'pending' and req.origin <> 'reseller') then
    raise exception 'This request is still waiting for the customer''s answer, so it cannot be marked as done yet';
  end if;

  -- The job card keeps when the work ended (and who it belonged to).
  select id into card_id from job_cards where service_request_id = p_request_id order by created_at limit 1;
  if card_id is not null then
    update job_cards set completed_at = coalesce(completed_at, now()) where id = card_id;
  else
    insert into job_cards (service_request_id, technician_id, completed_at)
    values (p_request_id, coalesce(req.technician_id, req.reseller_id), now());
  end if;

  update service_requests set status = 'resolved' where id = p_request_id;

  -- The customer is told by the notification trigger when the job was in progress; for a job that
  -- never reached that stage it is told here.
  customer := case when req.origin = 'app' and req.client_id is distinct from req.reseller_id then req.client_id end;
  if customer is not null and req.status <> 'in_progress' then
    perform add_notification(customer, 'job_completed', p_request_id, auth.uid(),
      'Your job is complete', coalesce(req.issue_type, 'a job'));
  end if;
end;
$$;

revoke all on function mark_job_done(uuid) from public;
grant execute on function mark_job_done(uuid) to authenticated;

-- Make the API pick up the new function at once (Supabase usually does this by itself).
notify pgrst, 'reload schema';
