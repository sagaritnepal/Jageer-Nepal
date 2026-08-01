-- Reward points: a running balance on profiles.reward_points, plus an
-- auditable log (reward_point_events) of how each point was earned. For
-- this first version, the only automatic trigger is a technician completing
-- a service request (status flips to 'resolved') -- +1 point, logged once
-- per request. Redeeming and referral crediting aren't wired up yet; this
-- just lays down the balance + ledger so the UI has something real to show.

alter table profiles add column if not exists reward_points integer not null default 0;

create table if not exists reward_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  points integer not null,
  reason text not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists reward_point_events_user_idx on reward_point_events (user_id, created_at desc);

alter table reward_point_events enable row level security;

create policy reward_point_events_select_owner on reward_point_events
  for select using (user_id = auth.uid());

create policy reward_point_events_admin_all on reward_point_events
  for all using (is_admin()) with check (is_admin());

create or replace function award_technician_reward_point()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' and new.technician_id is not null then
    insert into reward_point_events (user_id, points, reason, source_type, source_id)
    values (new.technician_id, 1, 'Completed a service request', 'service_request', new.id);

    update profiles set reward_points = reward_points + 1 where id = new.technician_id;
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_award_reward_point on service_requests;
create trigger service_requests_award_reward_point
  after update of status on service_requests
  for each row execute function award_technician_reward_point();

-- Backfill: award points for jobs already resolved before this trigger
-- existed, one event per request (guarded by not already having an event
-- for that source so this migration is safe to re-run).
insert into reward_point_events (user_id, points, reason, source_type, source_id)
select sr.technician_id, 1, 'Completed a service request', 'service_request', sr.id
from service_requests sr
where sr.status = 'resolved'
  and sr.technician_id is not null
  and not exists (
    select 1 from reward_point_events e
    where e.source_type = 'service_request' and e.source_id = sr.id
  );

update profiles p
set reward_points = p.reward_points + backfill.point_count
from (
  select user_id, count(*) as point_count
  from reward_point_events
  where source_type = 'service_request'
  group by user_id
) backfill
where p.id = backfill.user_id
  and p.reward_points = 0;
