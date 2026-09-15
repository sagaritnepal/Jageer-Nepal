-- Two additions so a reseller's team reads as one list:
--   1. their employees' sign-in emails, which live in auth.users and are
--      not readable by a normal client;
--   2. auto-linking - when someone a reseller added by hand later signs up
--      as a technician, their hand-written record is tied to the new
--      account and the reseller's invite goes out on its own.
-- Additive only. Safe to run once against the existing schema.

alter table manual_employees add column if not exists linked_profile_id uuid references profiles(id);

create index if not exists manual_employees_linked_idx on manual_employees(linked_profile_id);

-- Only the technicians this reseller has an employment row with, and only
-- their address - never a listing of anyone else.
create or replace function my_employee_emails()
returns table (id uuid, email text)
language sql
security definer
set search_path = public
as $$
  select distinct p.id, u.email::text
  from technician_employment te
  join profiles p on p.id = te.technician_id
  join auth.users u on u.id = p.id
  where te.reseller_id = auth.uid()
    and te.status in ('pending', 'accepted');
$$;

grant execute on function my_employee_emails() to authenticated;

-- A hand-added person who later signs up: match on phone or email first
-- (those identify someone), and fall back to an exact name match only when
-- the reseller stored neither, so two different Ram Bahadurs can't be
-- merged by name alone. The reseller's invite is then created for them to
-- accept - being listed by hand is not consent to be employed in-app.
create or replace function manual_employee_autolink()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  m record;
begin
  if new.role is distinct from 'technician' then
    return new;
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = new.id;

  for m in
    select * from manual_employees
    where linked_profile_id is null
      and is_active
      and (
        (new.phone is not null and phone = new.phone)
        or (v_email is not null and email is not null and lower(trim(email)) = v_email)
        or (phone is null and email is null and new.full_name is not null
            and lower(trim(name)) = lower(trim(new.full_name)))
      )
  loop
    update manual_employees set linked_profile_id = new.id where id = m.id;

    -- Skip if they already work for someone, or this pair already has an
    -- open invite/request (see technician_employment's unique indexes).
    if not exists (
      select 1 from technician_employment te
      where te.technician_id = new.id
        and (te.status = 'accepted' or (te.status = 'pending' and te.reseller_id = m.owner_id))
    ) then
      insert into technician_employment (technician_id, reseller_id, status, initiated_by, work_start_time, work_end_time)
      values (new.id, m.owner_id, 'pending', 'reseller', m.work_start_time, m.work_end_time);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists manual_employee_autolink_insert on profiles;
create trigger manual_employee_autolink_insert
  after insert on profiles
  for each row execute function manual_employee_autolink();

-- Someone who signed up before filling in their name/phone, or who switched
-- their account to the technician role afterwards, still gets linked.
drop trigger if exists manual_employee_autolink_update on profiles;
create trigger manual_employee_autolink_update
  after update of full_name, phone, role on profiles
  for each row execute function manual_employee_autolink();
