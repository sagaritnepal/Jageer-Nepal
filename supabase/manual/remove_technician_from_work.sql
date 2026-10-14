-- Remove one technician from one reseller's work.
--
-- NOT a migration: do not put this in supabase/migrations. It is run by hand, once, in the Supabase
-- SQL Editor, for one technician and one reseller.
--
-- What it does (STEP 2):
--   1. Cancels every live job of the technician under that reseller (status assigned or in progress) -
--      the same change "Cancel work" makes in the app, so the ledger and notifications follow as
--      they do there. Finished, paid and already-cancelled jobs are not touched, so no bill, payment
--      or history is changed.
--   2. Ends the technician's employment with that reseller (status 'ended') if it is accepted.
--   3. Only if you switch v_clear_technician on: takes the technician's name off the jobs it cancelled.
--
-- Before STEP 2, run STEP 1: it only reads, and shows who matches and which jobs will be cancelled.
-- STEP 2 stops with an error, and changes nothing, unless exactly one technician and one reseller match.

-- ============================================================================================
-- STEP 1 - look first (read-only). Edit the two names in the three queries if they differ.
-- ============================================================================================

-- 1a. Who matches. There must be exactly one technician and one reseller.
select id, full_name, role, phone
from profiles
where (role = 'technician'::user_role and lower(trim(full_name)) = lower('Sushant Khanal'))
   or (role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi'));

-- 1b. The jobs STEP 2 will cancel.
select sr.ticket_no, sr.issue_type, sr.status, sr.customer_name, sr.quoted_price, sr.scheduled_date
from service_requests sr
where sr.technician_id = (
        select id from profiles
        where role = 'technician'::user_role and lower(trim(full_name)) = lower('Sushant Khanal'))
  and sr.reseller_id = (
        select id from profiles
        where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi'))
  and sr.status in ('assigned', 'in_progress')
order by sr.ticket_no;

-- 1c. The employment STEP 2 will end.
select te.id, te.status, te.staff_role, te.requested_at, te.ended_at
from technician_employment te
where te.technician_id = (
        select id from profiles
        where role = 'technician'::user_role and lower(trim(full_name)) = lower('Sushant Khanal'))
  and te.reseller_id = (
        select id from profiles
        where role = 'reseller'::user_role and lower(trim(full_name)) = lower('Sagar Rayamajhi'));

-- ============================================================================================
-- STEP 2 - make the change. Run only after STEP 1 looks right.
-- ============================================================================================
do $$
declare
  v_technician_name  text    := 'Sushant Khanal';
  v_reseller_name    text    := 'Sagar Rayamajhi';
  -- Off by default: clearing the technician from a cancelled job also removes it from his Work
  -- History, which cannot be undone. Cancelled jobs already leave the Work Hub without it.
  v_clear_technician boolean := false;

  v_technician uuid;
  v_reseller   uuid;
  v_job_ids    uuid[];
  v_cancelled  int := 0;
  v_ended      int := 0;
begin
  -- strict: raises (and so changes nothing) when there is no match, or more than one.
  select id into strict v_technician from profiles
   where role = 'technician'::user_role and lower(trim(full_name)) = lower(v_technician_name);
  select id into strict v_reseller from profiles
   where role = 'reseller'::user_role and lower(trim(full_name)) = lower(v_reseller_name);

  -- Act as the reseller for this transaction, so the cancellation is recorded - and the technician
  -- told - exactly as it is when the reseller cancels from the app.
  perform set_config('request.jwt.claim.sub', v_reseller::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_reseller, 'role', 'authenticated')::text, true);

  -- 1. Cancel the live jobs.
  with cancelled as (
    update service_requests
       set status = 'cancelled'
     where reseller_id = v_reseller
       and technician_id = v_technician
       and status in ('assigned', 'in_progress')
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_job_ids from cancelled;
  v_cancelled := coalesce(cardinality(v_job_ids), 0);

  -- 2. End the employment.
  update technician_employment
     set status = 'ended', ended_at = now()
   where technician_id = v_technician
     and reseller_id = v_reseller
     and status = 'accepted';
  get diagnostics v_ended = row_count;

  -- 3. Optionally take the name off the jobs just cancelled.
  if v_clear_technician and v_cancelled > 0 then
    update service_requests set technician_id = null where id = any (v_job_ids);
  end if;

  raise notice 'Cancelled % job(s); ended % employment(s) for % under %.',
    v_cancelled, v_ended, v_technician_name, v_reseller_name;
end;
$$;
