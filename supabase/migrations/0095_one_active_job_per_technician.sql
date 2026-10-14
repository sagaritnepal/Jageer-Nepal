-- A technician works one job at a time. A job only frees them up for another
-- when it is finished, or when it is on hold: they ask to hold it (0076), the
-- reseller calls the customer and approves, and only then (hold_status =
-- 'on_hold') may they start or take something else.
--
-- Enforced here rather than in the app so every path honours it: accepting an
-- offer, taking an open team job, reopening a finished job, or a reseller
-- starting a job on their behalf. Resuming a held job is a hold change, not a
-- status change, so resume_job_hold checks the same rule.

create or replace function technician_busy_with_other_job(p_technician_id uuid, p_except uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from service_requests
    where technician_id = p_technician_id
      and id <> p_except
      and status = 'in_progress'
      and hold_status <> 'on_hold'
  );
$$;

create or replace function enforce_one_active_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'in_progress'
     and new.technician_id is not null
     and (tg_op = 'INSERT'
          or old.status is distinct from 'in_progress'
          or old.technician_id is distinct from new.technician_id)
     and technician_busy_with_other_job(new.technician_id, new.id) then
    raise exception 'Finish your current job or put it on hold (and get the reseller''s approval) before starting another';
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_one_active_job on service_requests;
create trigger service_requests_one_active_job
  before insert or update on service_requests
  for each row execute function enforce_one_active_job();

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
  if technician_busy_with_other_job(auth.uid(), p_request_id) then
    raise exception 'Finish or hold your other job before resuming this one';
  end if;

  update service_requests
  set hold_status = 'none', hold_resolved_at = now()
  where id = p_request_id;
end;
$$;
