-- Gives every job (service request) a short, permanent ticket number - #0001,
-- #0002, ... - so one can be named on the phone, searched for and told apart
-- from the others. The number is a plain serial, assigned the moment the job is
-- created (by the customer, the reseller or anyone else), never reused and never
-- changed. Jobs that already exist are numbered oldest first, so #1 is the first
-- job ever raised.
--
-- Run once, as a whole, in the SQL editor. It is one transaction: if anything
-- fails, nothing is changed.
--
-- service_requests has triggers that sync ledgers and finance, award reward
-- points and send notifications, so the backfill below turns the user triggers
-- off for its duration - numbering a job must not re-send anything or touch
-- updated_at - and turns them back on straight after.

begin;

create sequence if not exists service_request_ticket_seq;

alter table service_requests add column if not exists ticket_no bigint;

-- 1. Number the jobs that have no number yet, oldest first (carrying on after
--    any already numbered, so running this twice changes nothing).
alter table service_requests disable trigger user;

update service_requests sr
set ticket_no = n.rn
from (
  select id,
         row_number() over (order by created_at, id)
           + coalesce((select max(ticket_no) from service_requests), 0) as rn
  from service_requests
  where ticket_no is null
) n
where sr.id = n.id;

alter table service_requests enable trigger user;

-- 2. New jobs carry on from the highest number in use (never backwards).
select setval(
  'service_request_ticket_seq',
  greatest(
    coalesce((select max(ticket_no) from service_requests), 0) + 1,
    (select case when is_called then last_value + 1 else last_value end from service_request_ticket_seq)
  ),
  false
);

alter table service_requests alter column ticket_no set not null;

create unique index if not exists service_requests_ticket_no_key on service_requests (ticket_no);

-- 3. The number is the database's to give: a new job always gets the next one
--    (whatever the client sent is ignored, so nobody can pick or squat a
--    number), and an update can never change it.
create or replace function service_requests_assign_ticket_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.ticket_no := nextval('service_request_ticket_seq');
  else
    new.ticket_no := old.ticket_no;
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_assign_ticket_no on service_requests;
create trigger service_requests_assign_ticket_no
  before insert or update on service_requests
  for each row execute function service_requests_assign_ticket_no();

commit;

insert into supabase_migrations.schema_migrations (version, name)
values ('0086', 'service_request_ticket_no')
on conflict (version) do nothing;
