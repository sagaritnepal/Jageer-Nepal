-- Hand a job that is already under way to another technician.
--
-- Until now a reseller could only give a job to someone while it was still an unanswered offer; once
-- the technician accepted, the job was 'in_progress' and the database refused to move it (a reseller
-- got "This job cannot move from in_progress to assigned"). If that technician then went quiet or
-- could not finish, the only way out was to cancel the whole job.
--
-- hand_over_job() is the proper way: the reseller picks another technician and the job is offered to
-- them afresh. They accept it like any new job (technician_respond_to_job) and carry on from where
-- the first one got to - the parts, labour, chalan number and photo already recorded stay on the job.
--
-- What it does:
--   * only the job's reseller (or their supervisor, or an admin) may use it;
--   * only a job that is assigned (waiting) or in progress - not a finished, paid or cancelled one;
--   * the new person must be a technician, not the one who already has it, and not busy on another
--     job (the one-active-job rule, 0095, which also applies again when they accept);
--   * the job goes back to 'assigned' with the new technician, and any hold is cleared;
--   * the existing notification trigger (0083) tells the new technician "offered you a job" and the
--     old one "took the job back" - nothing to add for that.
--
-- And the accept step is changed so the job card follows the job: when a technician accepts a job that
-- already has a card (a handed-over one), the card becomes theirs, so they can fill in the rest and
-- complete it. Without this the first technician's card would stay theirs. That also fixes the same
-- gap for a job a supervisor reassigns (supervisor_assign_job, 0077).
--
-- Run once, in the Supabase SQL Editor. Safe to run more than once.

create or replace function hand_over_job(p_request_id uuid, p_technician_id uuid)
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

  -- coalesce: a job with no reseller makes the comparison NULL, which must read as "no".
  if not (
    coalesce(req.reseller_id = auth.uid(), false)
    or (req.reseller_id is not null and is_supervisor_for(req.reseller_id))
    or is_admin()
  ) then
    raise exception 'Only the reseller who owns this job can hand it over';
  end if;

  if req.status not in ('assigned', 'in_progress') then
    raise exception 'Only a job that is waiting or in progress can be handed over';
  end if;
  if req.payment_status <> 'unpaid' then
    raise exception 'This job has a payment recorded on it, so it cannot be handed over';
  end if;

  if p_technician_id is null then
    raise exception 'Pick a technician to hand the job to';
  end if;
  if not exists (select 1 from profiles where id = p_technician_id and role = 'technician'::user_role) then
    raise exception 'That person is not a technician';
  end if;
  if req.technician_id = p_technician_id then
    raise exception 'That technician already has this job';
  end if;
  if exists (
    select 1 from service_requests other
    where other.technician_id = p_technician_id
      and other.id <> p_request_id
      and other.status = 'in_progress'
      and other.hold_status <> 'on_hold'
  ) then
    raise exception 'That technician is already working on another job';
  end if;

  update service_requests
  set technician_id = p_technician_id,
      status = 'assigned',
      open_to_team = false,
      hold_status = 'none',
      hold_note = null,
      hold_requested_at = null,
      hold_resolved_at = case when req.hold_status <> 'none' then now() else req.hold_resolved_at end
  where id = p_request_id;
end;
$$;

revoke all on function hand_over_job(uuid, uuid) from public;
grant execute on function hand_over_job(uuid, uuid) to authenticated;

-- The accept step, as in 0071, plus: a card that already exists becomes the accepting technician's.
create or replace function technician_respond_to_job(p_request_id uuid, p_accept boolean)
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
    raise exception 'This job was not offered to you';
  end if;
  if req.status <> 'assigned' then
    raise exception 'This job offer is no longer open';
  end if;

  if p_accept then
    update service_requests set status = 'in_progress' where id = p_request_id;
    if not exists (select 1 from job_cards where service_request_id = p_request_id) then
      insert into job_cards (service_request_id, technician_id, started_at)
      values (p_request_id, req.technician_id, now());
    else
      -- A job handed over part-way already has a card, with what the first technician recorded.
      update job_cards
      set technician_id = req.technician_id
      where service_request_id = p_request_id
        and technician_id is distinct from req.technician_id;
    end if;
  else
    update service_requests
    set technician_id = null,
        status = case when req.origin = 'reseller' then 'pending'::request_status else 'approved'::request_status end
    where id = p_request_id;
  end if;
end;
$$;

revoke all on function technician_respond_to_job(uuid, boolean) from public;
grant execute on function technician_respond_to_job(uuid, boolean) to authenticated;
