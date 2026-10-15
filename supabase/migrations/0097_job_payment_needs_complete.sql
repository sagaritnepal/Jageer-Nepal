-- set_job_payment (0078) is the one way the app records a job's payment, but it never checked that
-- the job was finished. The plain-update path has always refused a payment on a job that is not
-- complete ("A job can only be paid once it is complete", 0077); the function - which runs with the
-- owner's rights and so skips that guard - lost the rule. The app hides the button until a job is
-- finished, so only a direct call could mark an unfinished job paid; this closes that.
--
-- What changes: setting a job to 'partial' or 'paid' now needs its status to be 'resolved'.
-- Setting it back to 'unpaid' is still allowed at any time (a part-paid job can be reopened, and the
-- payment has to be able to come off it). Admins are not held to the new rule, as with the other
-- guards on service_requests. Everything else in the function is exactly as it was.
--
-- Run once, in the Supabase SQL Editor. Safe to run more than once.

create or replace function set_job_payment(p_request_id uuid, p_status text, p_amount_paid numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req service_requests%rowtype;
  job_total numeric;
  paid numeric;
begin
  if p_status not in ('unpaid', 'partial', 'paid') then
    raise exception 'Unknown payment status';
  end if;

  select * into req from service_requests where id = p_request_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  -- coalesce, not a bare comparison: a job with no technician yet makes
  -- `technician_id = auth.uid()` NULL, and `not (false or NULL)` is NULL,
  -- which is not true - so the check would quietly pass and let anyone
  -- signed in change the payment.
  if not (
    coalesce(req.reseller_id = auth.uid(), false)
    or coalesce(req.technician_id = auth.uid(), false)
    or (req.reseller_id is not null and is_supervisor_for(req.reseller_id))
    or is_admin()
  ) then
    raise exception 'Only the reseller, a supervisor or the technician on this job can change its payment';
  end if;

  -- New: money can only come in on a finished job. Taking a payment back off ('unpaid') is always fine.
  if p_status in ('partial', 'paid') and req.status <> 'resolved' and not is_admin() then
    raise exception 'A job can only be paid once it is complete';
  end if;

  job_total := service_request_amount(p_request_id, req.quoted_price);

  if p_status = 'paid' then
    paid := coalesce(job_total, coalesce(p_amount_paid, 0));
  elsif p_status = 'partial' then
    paid := coalesce(p_amount_paid, 0);
    if paid <= 0 then
      raise exception 'Enter how much has been received';
    end if;
    if job_total is not null and paid >= job_total then
      -- Received the lot: that is simply paid, whatever the button said.
      p_status := 'paid';
      paid := job_total;
    end if;
  else
    paid := 0;
  end if;

  update service_requests
  set payment_status = p_status,
      amount_paid = paid
  where id = p_request_id;
end;
$$;

grant execute on function set_job_payment(uuid, text, numeric) to authenticated;
