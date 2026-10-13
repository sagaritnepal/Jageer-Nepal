-- Gives every shop order a token number from the SAME serial as jobs (0086), so a job and an
-- order never share one: "Token #0031" names exactly one thing on the Requests page. Existing
-- orders are numbered oldest first after the highest number in use by jobs or orders; new orders
-- take the next one. The database gives the number and it never changes.
--
-- orders has triggers (notifications, stock, payouts), so the backfill turns the user triggers
-- off for its duration. Run once, as a whole, in the SQL editor. Requires 0086.

begin;

alter table orders add column if not exists ticket_no bigint;

alter table orders disable trigger user;

update orders o
set ticket_no = n.rn
from (
  select id,
         row_number() over (order by created_at, id)
           + greatest(
               coalesce((select max(ticket_no) from service_requests), 0),
               coalesce((select max(ticket_no) from orders), 0)
             ) as rn
  from orders
  where ticket_no is null
) n
where o.id = n.id;

alter table orders enable trigger user;

select setval(
  'service_request_ticket_seq',
  greatest(
    coalesce((select max(ticket_no) from service_requests), 0),
    coalesce((select max(ticket_no) from orders), 0),
    (select case when is_called then last_value else last_value - 1 end from service_request_ticket_seq)
  ) + 1,
  false
);

alter table orders alter column ticket_no set not null;
create unique index if not exists orders_ticket_no_key on orders (ticket_no);

create or replace function orders_assign_ticket_no()
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

drop trigger if exists orders_assign_ticket_no on orders;
create trigger orders_assign_ticket_no
  before insert or update on orders
  for each row execute function orders_assign_ticket_no();

commit;
