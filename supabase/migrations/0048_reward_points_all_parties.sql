-- 0046 only rewarded the technician when a service request was resolved.
-- Broaden that to 1 point each for everyone actually engaged in that task:
-- the client who booked it, the technician who did the work, and the
-- reseller who facilitated it. Each gets their own event row.

-- Existing technician events from 0046 used source_type = 'service_request'
-- - rename them to the new role-specific naming so all three roles are
-- consistent going forward.
update reward_point_events set source_type = 'service_request_technician'
where source_type = 'service_request';

create or replace function award_reward_points_for_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    if new.technician_id is not null then
      insert into reward_point_events (user_id, points, reason, source_type, source_id)
      values (new.technician_id, 1, 'Completed a service request', 'service_request_technician', new.id);
      update profiles set reward_points = reward_points + 1 where id = new.technician_id;
    end if;

    if new.client_id is not null then
      insert into reward_point_events (user_id, points, reason, source_type, source_id)
      values (new.client_id, 1, 'Your service request was completed', 'service_request_client', new.id);
      update profiles set reward_points = reward_points + 1 where id = new.client_id;
    end if;

    if new.reseller_id is not null then
      insert into reward_point_events (user_id, points, reason, source_type, source_id)
      values (new.reseller_id, 1, 'Facilitated a completed service request', 'service_request_reseller', new.id);
      update profiles set reward_points = reward_points + 1 where id = new.reseller_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_award_reward_point on service_requests;
create trigger service_requests_award_reward_point
  after update of status on service_requests
  for each row execute function award_reward_points_for_service_request();

drop function if exists award_technician_reward_point();

-- Backfill: award the client and reseller their point for every request
-- already resolved before this migration (technician was already backfilled
-- by 0046) - each insert is guarded so re-running this file is a no-op.
with client_backfill as (
  insert into reward_point_events (user_id, points, reason, source_type, source_id)
  select sr.client_id, 1, 'Your service request was completed', 'service_request_client', sr.id
  from service_requests sr
  where sr.status = 'resolved'
    and sr.client_id is not null
    and not exists (
      select 1 from reward_point_events e
      where e.source_type = 'service_request_client' and e.source_id = sr.id
    )
  returning user_id
),
reseller_backfill as (
  insert into reward_point_events (user_id, points, reason, source_type, source_id)
  select sr.reseller_id, 1, 'Facilitated a completed service request', 'service_request_reseller', sr.id
  from service_requests sr
  where sr.status = 'resolved'
    and sr.reseller_id is not null
    and not exists (
      select 1 from reward_point_events e
      where e.source_type = 'service_request_reseller' and e.source_id = sr.id
    )
  returning user_id
),
combined as (
  select user_id from client_backfill
  union all
  select user_id from reseller_backfill
),
totals as (
  select user_id, count(*) as point_count from combined group by user_id
)
update profiles p
set reward_points = p.reward_points + totals.point_count
from totals
where p.id = totals.user_id;
