-- In-app notifications, written by the database itself so nothing a technician
-- does can be missed - even when the person who needs to know has the app
-- closed. The app reads this table for the bell, the Notifications page and the
-- pop-up (which arrives through realtime the moment a row is added).
--
-- A trigger on service_requests adds a row whenever:
--   the TECHNICIAN on a job does something the reseller should hear about -
--     accepts it (or takes an open team job), declines the offer, asks to put
--     it on hold, resumes it, marks it complete, reopens it, records a
--     payment, or adds a chalan photo
--   the RESELLER cancels work the technician has been given or started -
--     the technician is told
-- Who did it comes from auth.uid(), so a reseller doing the same thing on
-- their own job (taking an offer back, recording a payment) never notifies
-- themselves. Changes made by the service role (no signed-in user) are skipped.
--
-- Safe to run more than once. Rows older than 30 days are cleared as new ones
-- are added.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  request_id uuid references service_requests(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Nobody writes a notification from the app: the trigger below does, as the
-- table owner. The only thing a person may change is marking their own as read.
revoke insert, update, delete on notifications from anon, authenticated;
grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;

-- Live pop-ups: the app listens for new rows for the signed-in user.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

create or replace function add_notification(
  p_user uuid,
  p_kind text,
  p_request uuid,
  p_actor uuid,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return;
  end if;

  insert into notifications (user_id, kind, request_id, actor_id, title, body)
  values (p_user, p_kind, p_request, p_actor, p_title, p_body);

  delete from notifications
  where user_id = p_user and created_at < now() - interval '30 days';
end;
$$;

revoke all on function add_notification(uuid, text, uuid, uuid, text, text) from public;

create or replace function notify_on_service_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  actor_business text;
  job text := coalesce(new.issue_type, 'a job');
  tech uuid := coalesce(new.technician_id, old.technician_id);
begin
  if actor is null then
    return new;
  end if;

  select nullif(full_name, ''), nullif(business_name, '')
  into actor_name, actor_business
  from profiles where id = actor;

  -- The technician on the job did something: tell the reseller.
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

    if new.payment_status is distinct from old.payment_status
       or new.amount_paid is distinct from old.amount_paid then
      perform add_notification(new.reseller_id, 'payment_recorded', new.id, actor,
        coalesce(actor_name, 'A technician') || ' recorded a payment',
        job || ' - ' || case new.payment_status
          when 'paid' then 'paid in full'
          when 'partial' then 'part paid, NPR ' || coalesce(new.amount_paid, 0)::text || ' received'
          else 'payment cleared'
        end);
    end if;

    if coalesce(cardinality(new.chalan_urls), 0) > coalesce(cardinality(old.chalan_urls), 0) then
      perform add_notification(new.reseller_id, 'chalan_added', new.id, actor,
        coalesce(actor_name, 'A technician') || ' added a chalan photo', job);
    end if;
  end if;

  -- The reseller cancelled work the technician had been given or had started.
  if new.status = 'cancelled'
     and old.status in ('assigned', 'in_progress')
     and old.technician_id is not null
     and actor is distinct from old.technician_id then
    perform add_notification(old.technician_id, 'work_cancelled', new.id, actor,
      coalesce(actor_business, actor_name, 'The reseller') || ' cancelled the work', job);
  end if;

  return new;
end;
$$;

revoke all on function notify_on_service_request_change() from public;

drop trigger if exists notify_on_service_request_change on service_requests;
create trigger notify_on_service_request_change
  after update on service_requests
  for each row execute function notify_on_service_request_change();
