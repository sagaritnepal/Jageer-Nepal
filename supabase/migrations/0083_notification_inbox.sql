-- One inbox for everybody. Builds on 0082 (the notifications table and the
-- trigger on service_requests):
--
--   * people can clear their own notifications (delete)
--   * the service_requests trigger now also tells
--       the CUSTOMER   - quote received, technician assigned, work started,
--                        job complete, payment received, request cancelled
--       the RESELLER   - customer approved the quote, customer cancelled
--       the TECHNICIAN - job offered, offer taken back / given to someone
--                        else, hold approved or declined, job reopened,
--                        payment recorded, work cancelled
--     on top of what 0082 already sent the reseller
--   * a new trigger on technician_employment tells people about their team:
--       invitation / application, accepted or declined, a request to leave
--       and the answer, and being removed from a team
--
-- A notification that asks something of you (a job offer, a hold request, a team
-- invitation, a request to leave) is marked read as soon as it has been answered,
-- by anyone, so the bell never keeps counting something already dealt with.
--
-- Who did it comes from auth.uid(), so nobody is ever notified about their
-- own action, and changes made by the service role (no signed-in user, e.g. the
-- Fonepay webhook) are skipped.
--
-- Safe to run more than once.

-- 1. Clearing ------------------------------------------------------------------

drop policy if exists notifications_delete_own on notifications;
create policy notifications_delete_own on notifications
  for delete using (user_id = auth.uid());

grant delete on notifications to authenticated;

-- 2. Jobs ----------------------------------------------------------------------

create or replace function notify_on_service_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  reseller_label text;
  new_tech_name text;
  job text := coalesce(new.issue_type, 'a job');
  tech uuid := coalesce(new.technician_id, old.technician_id);
  -- A real customer account: app requests only (a reseller's own walk-in
  -- customer has no app, and its client_id is just the reseller again).
  customer uuid := case when new.origin = 'app' and new.client_id is distinct from new.reseller_id then new.client_id end;
  price_note text := case when new.quoted_price is not null and new.quoted_price > 0
                          then ' - NPR ' || trim(to_char(round(new.quoted_price), 'FM999,999,999,990')) else '' end;
  pay_note text;
  payment_changed boolean := new.payment_status is distinct from old.payment_status
                             or new.amount_paid is distinct from old.amount_paid;
begin
  -- Questions that were just answered stop asking for attention (whoever
  -- answered, and even when the change came from the service role).
  if old.status = 'assigned'
     and (new.status is distinct from 'assigned' or new.technician_id is distinct from old.technician_id) then
    update notifications set read_at = now()
    where request_id = new.id and kind = 'job_offered' and read_at is null;
  end if;
  if old.hold_status = 'requested' and new.hold_status is distinct from 'requested' then
    update notifications set read_at = now()
    where request_id = new.id and kind = 'hold_requested' and read_at is null;
  end if;

  if actor is null then
    return new;
  end if;

  select nullif(full_name, '') into actor_name from profiles where id = actor;
  if new.reseller_id is not null then
    select coalesce(nullif(business_name, ''), nullif(full_name, ''))
    into reseller_label from profiles where id = new.reseller_id;
  end if;
  reseller_label := coalesce(reseller_label, 'The reseller');
  if new.technician_id is not null then
    select nullif(full_name, '') into new_tech_name from profiles where id = new.technician_id;
  end if;

  pay_note := case new.payment_status
    when 'paid' then 'paid in full'
    when 'partial' then 'part paid, NPR ' || coalesce(new.amount_paid, 0)::text || ' received'
    else 'payment cleared'
  end;

  -- 1. The technician on the job did something: tell the reseller. ---------------
  if new.reseller_id is not null and tech is not null and actor = tech and actor <> new.reseller_id then
    -- Accepted an offer, or took an open team job.
    if new.status = 'in_progress' and old.status in ('pending', 'quoted', 'approved', 'assigned') then
      perform add_notification(new.reseller_id, 'job_accepted', new.id, actor,
        coalesce(actor_name, 'A technician') || ' accepted the job', job);
    end if;

    -- Turned the offer down (the job goes back to the reseller).
    if old.status = 'assigned' and new.technician_id is null and new.status in ('pending', 'approved') then
      perform add_notification(new.reseller_id, 'job_declined', new.id, actor,
        coalesce(actor_name, 'A technician') || ' declined the job', job);
    end if;

    if new.hold_status = 'requested' and old.hold_status is distinct from 'requested' then
      perform add_notification(new.reseller_id, 'hold_requested', new.id, actor,
        coalesce(actor_name, 'A technician') || ' asked to put a job on hold',
        job || coalesce(' - "' || nullif(new.hold_note, '') || '"', ''));
    end if;

    if old.hold_status = 'on_hold' and new.hold_status = 'none' and new.status = 'in_progress' then
      perform add_notification(new.reseller_id, 'hold_resumed', new.id, actor,
        coalesce(actor_name, 'A technician') || ' resumed work', job);
    end if;

    if old.status = 'in_progress' and new.status = 'resolved' then
      perform add_notification(new.reseller_id, 'job_completed', new.id, actor,
        coalesce(actor_name, 'A technician') || ' marked the job complete', job);
    end if;

    if old.status = 'resolved' and new.status = 'in_progress' then
      perform add_notification(new.reseller_id, 'job_reopened', new.id, actor,
        coalesce(actor_name, 'A technician') || ' reopened a completed job', job);
    end if;

    if payment_changed then
      perform add_notification(new.reseller_id, 'payment_recorded', new.id, actor,
        coalesce(actor_name, 'A technician') || ' recorded a payment', job || ' - ' || pay_note);
    end if;

    if coalesce(cardinality(new.chalan_urls), 0) > coalesce(cardinality(old.chalan_urls), 0) then
      perform add_notification(new.reseller_id, 'chalan_added', new.id, actor,
        coalesce(actor_name, 'A technician') || ' added a chalan photo', job);
    end if;
  end if;

  -- 2. The customer's own request moved: tell the customer. ----------------------
  if customer is not null and actor is distinct from customer then
    if old.status = 'pending' and new.status = 'quoted' then
      perform add_notification(customer, 'quote_received', new.id, actor,
        reseller_label || ' sent you a quote', job || price_note);
    end if;

    if new.status = 'assigned' and new.technician_id is not null
       and (old.status is distinct from 'assigned' or new.technician_id is distinct from old.technician_id) then
      perform add_notification(customer, 'technician_assigned', new.id, actor,
        coalesce(new_tech_name, 'A technician') || ' was assigned to your request', job);
    end if;

    if new.status = 'in_progress' and old.status in ('pending', 'quoted', 'approved', 'assigned') then
      perform add_notification(customer, 'job_started', new.id, actor,
        coalesce(new_tech_name, 'Your technician') || ' started work on your request', job);
    end if;

    if old.status = 'in_progress' and new.status = 'resolved' then
      perform add_notification(customer, 'job_completed', new.id, actor,
        'Your job is complete', job || price_note);
    end if;

    if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
      perform add_notification(customer, 'payment_recorded', new.id, actor,
        'Payment received', job || ' - paid in full');
    end if;

    if new.status = 'cancelled' and old.status not in ('cancelled', 'resolved') then
      perform add_notification(customer, 'work_cancelled', new.id, actor,
        reseller_label || ' cancelled your request', job);
    end if;
  end if;

  -- 3. The customer answered a quote or cancelled: tell the reseller. ------------
  if new.reseller_id is not null and customer is not null and actor = customer then
    if old.status = 'quoted' and new.status = 'approved' then
      perform add_notification(new.reseller_id, 'quote_approved', new.id, actor,
        coalesce(actor_name, 'The customer') || ' approved your quote', job || price_note);
    end if;

    if new.status = 'cancelled' and old.status not in ('cancelled', 'resolved') then
      perform add_notification(new.reseller_id, 'work_cancelled', new.id, actor,
        coalesce(actor_name, 'The customer') || ' cancelled the request', job);
    end if;
  end if;

  -- 4. The reseller's side moved: tell the technician. ---------------------------
  -- Offered the job (a first offer, or handed to a different technician).
  if new.technician_id is not null and new.status = 'assigned'
     and (old.status is distinct from 'assigned' or new.technician_id is distinct from old.technician_id)
     and actor is distinct from new.technician_id then
    perform add_notification(new.technician_id, 'job_offered', new.id, actor,
      reseller_label || ' offered you a job', job);
  end if;

  -- Taken off the job: the offer withdrawn, or the work given to someone else.
  if old.technician_id is not null and new.technician_id is distinct from old.technician_id
     and new.status <> 'cancelled' and actor is distinct from old.technician_id then
    perform add_notification(old.technician_id, 'offer_withdrawn', new.id, actor,
      reseller_label || ' took the job back', job);
  end if;

  if new.technician_id is not null and actor is distinct from new.technician_id then
    -- The answer to their hold request.
    if old.hold_status = 'requested' and new.hold_status in ('on_hold', 'none') and new.status = 'in_progress' then
      if new.hold_status = 'on_hold' then
        perform add_notification(new.technician_id, 'hold_approved', new.id, actor,
          reseller_label || ' approved the hold', job);
      else
        perform add_notification(new.technician_id, 'hold_declined', new.id, actor,
          reseller_label || ' declined the hold - keep working', job);
      end if;
    end if;

    if old.status = 'resolved' and new.status = 'in_progress' then
      perform add_notification(new.technician_id, 'job_reopened', new.id, actor,
        reseller_label || ' reopened the job', job);
    end if;

    if payment_changed then
      perform add_notification(new.technician_id, 'payment_recorded', new.id, actor,
        reseller_label || ' recorded a payment', job || ' - ' || pay_note);
    end if;
  end if;

  -- The reseller cancelled work the technician had been given or had started.
  if new.status = 'cancelled'
     and old.status in ('assigned', 'in_progress')
     and old.technician_id is not null
     and actor is distinct from old.technician_id then
    perform add_notification(old.technician_id, 'work_cancelled', new.id, actor,
      reseller_label || ' cancelled the work', job);
  end if;

  return new;
end;
$$;

revoke all on function notify_on_service_request_change() from public;

drop trigger if exists notify_on_service_request_change on service_requests;
create trigger notify_on_service_request_change
  after update on service_requests
  for each row execute function notify_on_service_request_change();

-- 3. Teams ---------------------------------------------------------------------

create or replace function notify_on_employment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  tech_name text;
  employer_label text;
begin
  if tg_op = 'UPDATE' then
    -- An invitation / application that has been answered, or a request to
    -- leave that has been dealt with, is no longer waiting on anyone.
    if old.status = 'pending' and new.status is distinct from 'pending' then
      update notifications set read_at = now()
      where read_at is null
        and ((kind = 'team_invite' and user_id = new.technician_id and actor_id = new.reseller_id)
          or (kind = 'team_application' and user_id = new.reseller_id and actor_id = new.technician_id));
    end if;
    if old.leave_requested_at is not null
       and (new.leave_requested_at is null or new.status is distinct from 'accepted') then
      update notifications set read_at = now()
      where read_at is null and kind = 'leave_requested'
        and user_id = new.reseller_id and actor_id = new.technician_id;
    end if;
  end if;

  if actor is null then
    return new;
  end if;

  select nullif(full_name, '') into tech_name from profiles where id = new.technician_id;
  select coalesce(nullif(business_name, ''), nullif(full_name, ''))
  into employer_label from profiles where id = new.reseller_id;
  employer_label := coalesce(employer_label, 'Your employer');

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      if new.initiated_by = 'reseller' then
        perform add_notification(new.technician_id, 'team_invite', null, actor,
          employer_label || ' invited you to join their team', null);
      else
        perform add_notification(new.reseller_id, 'team_application', null, actor,
          coalesce(tech_name, 'A technician') || ' applied to join your team', null);
      end if;
    end if;
    return new;
  end if;

  -- The other side answered an invitation or an application.
  if old.status = 'pending' and new.status in ('accepted', 'rejected') then
    if new.initiated_by = 'reseller' then
      perform add_notification(new.reseller_id,
        case when new.status = 'accepted' then 'team_accepted' else 'team_declined' end,
        null, actor,
        coalesce(tech_name, 'The technician') || case when new.status = 'accepted' then ' accepted your invite' else ' declined your invite' end,
        null);
    else
      perform add_notification(new.technician_id,
        case when new.status = 'accepted' then 'team_accepted' else 'team_declined' end,
        null, actor,
        employer_label || case when new.status = 'accepted' then ' accepted your application' else ' declined your application' end,
        null);
    end if;
  end if;

  -- A technician asked to leave.
  if new.status = 'accepted' and new.leave_requested_at is not null and old.leave_requested_at is null then
    perform add_notification(new.reseller_id, 'leave_requested', null, actor,
      coalesce(tech_name, 'A technician') || ' asked to leave your team', nullif(new.leave_reason, ''));
  end if;

  -- The employer said no to a request to leave.
  if new.leave_rejected_at is not null and new.leave_rejected_at is distinct from old.leave_rejected_at then
    perform add_notification(new.technician_id, 'leave_declined', null, actor,
      employer_label || ' declined your request to leave', null);
  end if;

  -- The employment ended: the employer approved a leave request, or removed them.
  if old.status = 'accepted' and new.status = 'ended' then
    if old.leave_requested_at is not null then
      perform add_notification(new.technician_id, 'leave_approved', null, actor,
        employer_label || ' approved your request to leave', null);
    else
      perform add_notification(new.technician_id, 'team_removed', null, actor,
        employer_label || ' removed you from their team', null);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function notify_on_employment_change() from public;

drop trigger if exists notify_on_employment_change on technician_employment;
create trigger notify_on_employment_change
  after insert or update on technician_employment
  for each row execute function notify_on_employment_change();
