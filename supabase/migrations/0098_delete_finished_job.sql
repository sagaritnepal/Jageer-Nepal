-- Delete a finished job from the app: the Delete job button on a completed or cancelled job in the
-- reseller's Requests table. Until now a completed job could only be cancelled (after a reopen) or
-- removed with a SQL script.
--
-- What the function allows - and refuses:
--   * only the reseller who owns the job (or an admin);
--   * only a job that is completed or cancelled - a job still under way is cancelled first;
--   * only a job with NO money on it: no payment recorded (even part), and not on a bill. Money
--     feeds the cash / bank / Day Book figures, so a job that has any is handled by taking the
--     payment or the bill off first, in the app, where the figures are kept right;
--   * the job's own posted price (its debit on the customer's ledger) goes with it, and the reward
--     points it earned are taken back - the same as reopening a job does.
--
-- What it removes with the job: its job card, its chat, its review, and any other row that points at
-- it (found from the database's own foreign keys, so a table added later is covered). Notifications
-- about it go automatically. Chalan photo files stay in storage.
--
-- Run once, in the Supabase SQL Editor. Safe to run more than once.

create or replace function delete_finished_job(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
  ev record;
  r record;
begin
  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  -- coalesce: a job with no reseller makes the comparison NULL, which must read as "no".
  if not (coalesce(req.reseller_id = auth.uid(), false) or is_admin()) then
    raise exception 'Only the reseller who owns this job can delete it';
  end if;

  if req.status not in ('resolved', 'cancelled') then
    raise exception 'Only a completed or cancelled job can be deleted - cancel this one first';
  end if;

  if req.payment_status <> 'unpaid' or coalesce(req.amount_paid, 0) > 0 then
    raise exception 'This job has a payment recorded on it, so it cannot be deleted';
  end if;

  if exists (
    select 1 from business_transactions b
    where b.source_type = 'service_request_payment' and b.source_id = p_request_id
  ) or exists (
    select 1 from customer_ledger_entries e
    where e.source_type = 'service_request_payment' and e.source_id = p_request_id
  ) then
    raise exception 'This job has a payment recorded on it, so it cannot be deleted';
  end if;

  if exists (
    select 1 from business_transactions b
    where b.source_type = 'service_request_bill'
      and (b.source_id = p_request_id or p_request_id = any (b.source_job_ids))
  ) then
    raise exception 'This job is on a bill. Delete the bill first, then the job';
  end if;

  -- The reward points it earned are taken back, as reopening a job does.
  for ev in
    select id, user_id, points from reward_point_events
    where source_id = p_request_id
      and source_type in ('service_request', 'service_request_technician', 'service_request_client', 'service_request_reseller')
  loop
    update profiles set reward_points = greatest(0, reward_points - ev.points) where id = ev.user_id;
    delete from reward_point_events where id = ev.id;
  end loop;

  -- The price the job posted on the customer's ledger when it was completed.
  delete from customer_ledger_entries where source_id = p_request_id and source_type = 'service_request';

  delete from messages where subject_type = 'service_request' and subject_id = p_request_id;

  -- Every other table that points at the job (job cards, reviews, ...).
  for r in
    select c.conrelid::regclass::text as tbl,
           a.attname as col,
           a.attnotnull as not_null,
           c.confdeltype as on_delete
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.service_requests'::regclass
      and cardinality(c.conkey) = 1
    order by 1, 2
  loop
    continue when r.tbl = 'service_requests';        -- never touch other jobs through a self link
    continue when r.on_delete in ('c', 'n');          -- the database clears these itself

    if r.not_null then
      execute format('delete from %s where %I = $1', r.tbl, r.col) using p_request_id;
    else
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using p_request_id;
    end if;
  end loop;

  delete from service_requests where id = p_request_id;
end;
$$;

revoke all on function delete_finished_job(uuid) from public;
grant execute on function delete_finished_job(uuid) to authenticated;
