-- Two job actions that each change several rows together, so they live in
-- one transaction on the server and check permission themselves:
--
-- 1. A technician answers a job offer (status 'assigned'): accept starts it
--    and opens its job card; reject hands the job back to the reseller in
--    the stage it was in before it was offered (a reseller's own customer
--    goes back to 'pending', an app customer's approved job to 'approved').
--
-- 2. A job marked complete by mistake can be reopened (back to
--    'in_progress') by its technician or reseller while it is still unpaid.
--    The ledger debit disappears on its own (sync_service_request_ledger
--    only keeps it while status = 'resolved'), but the +1 reward points each
--    party got for completion must be taken back here, or re-completing the
--    job would award them twice.

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
    end if;
  else
    update service_requests
    set technician_id = null,
        status = case when req.origin = 'reseller' then 'pending'::request_status else 'approved'::request_status end
    where id = p_request_id;
  end if;
end;
$$;

create or replace function reopen_completed_job(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
  ev record;
begin
  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;
  if auth.uid() is distinct from req.technician_id
     and auth.uid() is distinct from req.reseller_id
     and not is_admin() then
    raise exception 'You cannot change this job';
  end if;
  if req.status <> 'resolved' then
    raise exception 'This job is not marked complete';
  end if;
  if req.payment_status = 'paid' then
    raise exception 'This job is already paid, so it cannot be reopened';
  end if;

  for ev in
    select id, user_id, points from reward_point_events
    where source_id = p_request_id
      and source_type in ('service_request', 'service_request_technician', 'service_request_client', 'service_request_reseller')
  loop
    update profiles set reward_points = greatest(0, reward_points - ev.points) where id = ev.user_id;
    delete from reward_point_events where id = ev.id;
  end loop;

  update job_cards set completed_at = null where service_request_id = p_request_id;
  update service_requests set status = 'in_progress' where id = p_request_id;
end;
$$;

revoke all on function technician_respond_to_job(uuid, boolean) from public;
revoke all on function reopen_completed_job(uuid) from public;
grant execute on function technician_respond_to_job(uuid, boolean) to authenticated;
grant execute on function reopen_completed_job(uuid) to authenticated;
