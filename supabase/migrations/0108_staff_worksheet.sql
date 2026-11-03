-- 0108: the technician's Worksheet, and the owner alone controls Outsource Technician.
--
-- 1. staff_add_job(): an employee adds work to their employer's list. It goes where the team can see it and
--    choose it (open_to_team, the owner's "Outsource Technician" column), and the owner is told. It has no
--    price and no customer ledger link: those stay the owner's to set.
-- 2. Choosing a job is the existing claim_open_job(): first come, and the one-active-job rule (0095) means a
--    technician finishes or holds their current job before taking another.
-- 3. Only the owner moves a job into or out of Outsource Technician:
--    - supervisor_set_open_to_team() now refuses (kept, so an older app gets a clear message);
--    - supervisor_assign_job() refuses a job in Outsource Technician, or one held by an outside technician;
--    - a direct write to open_to_team is refused for anyone but the job's reseller.
--
-- Run once in the Supabase SQL Editor. Safe to run more than once.

create or replace function staff_add_job(
  p_issue_type text,
  p_customer_name text,
  p_customer_phone text default null,
  p_address text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  staff_name text;
  new_id uuid;
begin
  select te.reseller_id into owner_id
  from technician_employment te
  where te.technician_id = auth.uid() and te.status = 'accepted'
  order by te.requested_at desc
  limit 1;
  if owner_id is null then
    raise exception 'Only an employee can add work to their employer''s list';
  end if;
  if coalesce(trim(p_issue_type), '') = '' then
    raise exception 'Choose or type the service';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Add the customer''s name';
  end if;

  insert into service_requests (
    client_id, reseller_id, origin, customer_name, customer_phone, contact_person_name, contact_person_phone,
    issue_type, description, status, open_to_team, location_data, scheduled_date
  )
  values (
    owner_id, owner_id, 'reseller', trim(p_customer_name), nullif(trim(p_customer_phone), ''),
    trim(p_customer_name), nullif(trim(p_customer_phone), ''),
    trim(p_issue_type), nullif(trim(p_description), ''), 'pending', true,
    case when coalesce(trim(p_address), '') = '' then null else jsonb_build_object('address', trim(p_address)) end,
    current_date
  )
  returning id into new_id;

  select full_name into staff_name from profiles where id = auth.uid();
  perform add_notification(owner_id, 'staff_added_work', new_id, auth.uid(),
    coalesce(staff_name, 'A technician') || ' added work', trim(p_issue_type) || ' · ' || trim(p_customer_name));

  return new_id;
end;
$$;

revoke all on function staff_add_job(text, text, text, text, text) from public;
grant execute on function staff_add_job(text, text, text, text, text) to authenticated;

-- Supervisors no longer open or take back work: that is the owner's.
create or replace function supervisor_set_open_to_team(p_request_id uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Only the owner can change Outsource Technician';
end;
$$;

create or replace function supervisor_assign_job(p_request_id uuid, p_technician_id uuid)
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
  if not is_supervisor_for(req.reseller_id) then
    raise exception 'Only a supervisor of this team can hand out its work';
  end if;
  if req.status in ('resolved', 'cancelled') then
    raise exception 'This job is already finished';
  end if;
  if req.open_to_team then
    raise exception 'This job is in Outsource Technician - only the owner can move it';
  end if;
  -- A job with an outside technician on it is the owner's to change.
  if req.technician_id is not null and not exists (
    select 1 from technician_employment te
    where te.technician_id = req.technician_id
      and te.reseller_id = req.reseller_id
      and te.status = 'accepted'
  ) then
    raise exception 'An outsource technician has this job - only the owner can change it';
  end if;
  if not exists (
    select 1 from technician_employment te
    where te.technician_id = p_technician_id
      and te.reseller_id = req.reseller_id
      and te.status = 'accepted'
  ) then
    raise exception 'That person is not on this team';
  end if;

  update service_requests
  set technician_id = p_technician_id,
      status = 'assigned',
      open_to_team = false
  where id = p_request_id;
end;
$$;

-- A direct API write can't change open_to_team either. Definer functions (claim_open_job, staff_add_job) run as
-- the function owner and do their own checks, so this only stops writes made as the signed-in user.
create or replace function service_requests_guard_open_to_team()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not is_admin()
     and new.open_to_team is distinct from old.open_to_team
     and auth.uid() is distinct from new.reseller_id then
    raise exception 'Only the owner can change Outsource Technician';
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_guard_open_to_team on service_requests;
create trigger service_requests_guard_open_to_team
  before update on service_requests
  for each row execute function service_requests_guard_open_to_team();
