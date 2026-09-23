-- Lets a technician ask to pause an in-progress job (e.g. waiting on a part,
-- blocked by the customer) with a note explaining why, and lets the
-- reseller who owns that job accept or reject the request. Kept as columns
-- on service_requests rather than a separate table - there is only ever one
-- "current" hold per job, and every screen that shows a job already reads
-- (and realtime-subscribes to) this table, so no new subscription is
-- needed for either side to see a hold request or its outcome live.
--
-- hold_status:
--   'none'      - normal, no hold in play
--   'requested' - technician asked, waiting on the reseller
--   'on_hold'   - reseller approved; job is paused until the technician
--                 resumes it themselves (no further approval needed to
--                 resume - the reseller's approval was for pausing, not a
--                 second gate on getting back to work)
-- hold_note carries the technician's reason and isn't cleared on
-- resolve/resume, so it stays visible as the record of the last hold even
-- after the job moves on - only a new hold request overwrites it.
alter table service_requests add column if not exists hold_status text not null default 'none'
  check (hold_status in ('none', 'requested', 'on_hold'));
alter table service_requests add column if not exists hold_note text;
alter table service_requests add column if not exists hold_requested_at timestamptz;
alter table service_requests add column if not exists hold_resolved_at timestamptz;

create or replace function request_job_hold(p_request_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
begin
  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if req.technician_id is distinct from auth.uid() then
    raise exception 'This is not your job';
  end if;
  if req.status <> 'in_progress' then
    raise exception 'Only a job that is in progress can be put on hold';
  end if;
  if req.hold_status <> 'none' then
    raise exception 'There is already a hold in progress for this job';
  end if;
  if p_note is null or btrim(p_note) = '' then
    raise exception 'Add a note explaining the hold';
  end if;

  update service_requests
  set hold_status = 'requested', hold_note = btrim(p_note), hold_requested_at = now(), hold_resolved_at = null
  where id = p_request_id;
end;
$$;

create or replace function respond_to_job_hold(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
begin
  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if req.reseller_id is distinct from auth.uid() then
    raise exception 'This is not your job';
  end if;
  if req.hold_status <> 'requested' then
    raise exception 'There is no hold request waiting on this job';
  end if;

  update service_requests
  set hold_status = case when p_approve then 'on_hold' else 'none' end,
      hold_resolved_at = now()
  where id = p_request_id;
end;
$$;

create or replace function resume_job_hold(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
begin
  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if req.technician_id is distinct from auth.uid() then
    raise exception 'This is not your job';
  end if;
  if req.hold_status <> 'on_hold' then
    raise exception 'This job is not on hold';
  end if;

  update service_requests
  set hold_status = 'none', hold_resolved_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function request_job_hold(uuid, text) from public;
revoke all on function respond_to_job_hold(uuid, boolean) from public;
revoke all on function resume_job_hold(uuid) from public;
grant execute on function request_job_hold(uuid, text) to authenticated;
grant execute on function respond_to_job_hold(uuid, boolean) to authenticated;
grant execute on function resume_job_hold(uuid) to authenticated;
