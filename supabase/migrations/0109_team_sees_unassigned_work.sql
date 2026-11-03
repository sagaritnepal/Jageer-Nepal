-- 0109: an employee's Worksheet lists ALL their employer's unassigned work, not only what is in Outsource
-- Technician, and they can take any of it.
--
-- Ready to work on means what the owner could assign: nobody on it yet, and either a job the owner put in
-- (pending, origin 'reseller') or a customer's app request whose quote is approved. A request still waiting on a
-- quote stays out of it. The owner alone still moves jobs into and out of Outsource Technician (0108).
--
-- Run once in the Supabase SQL Editor. Safe to run more than once.

drop policy if exists service_requests_select_team_unassigned on service_requests;
create policy service_requests_select_team_unassigned on service_requests
  for select using (
    technician_id is null
    and (status = 'approved' or (status = 'pending' and origin = 'reseller'))
    and exists (
      select 1 from technician_employment te
      where te.technician_id = auth.uid()
        and te.reseller_id = service_requests.reseller_id
        and te.status = 'accepted'
    )
  );

-- Taking a job stays first come, in one locked step, and starts it; the one-active-job rule (0095) still applies.
create or replace function claim_open_job(p_request_id uuid)
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
  if req.technician_id is not null then
    raise exception 'Someone else has already taken this job';
  end if;
  if not (
    req.status = 'approved'
    or (req.status = 'pending' and req.origin = 'reseller')
    or (req.open_to_team and req.status not in ('resolved', 'cancelled'))
  ) then
    raise exception 'This job is not ready to be taken';
  end if;
  if not exists (
    select 1 from technician_employment te
    where te.technician_id = auth.uid()
      and te.reseller_id = req.reseller_id
      and te.status = 'accepted'
  ) then
    raise exception 'This job is only open to that reseller''s own team';
  end if;

  update service_requests
  set technician_id = auth.uid(),
      status = 'in_progress',
      open_to_team = false
  where id = p_request_id;

  if not exists (select 1 from job_cards where service_request_id = p_request_id) then
    insert into job_cards (service_request_id, technician_id, started_at)
    values (p_request_id, auth.uid(), now());
  end if;
end;
$$;

grant execute on function claim_open_job(uuid) to authenticated;
