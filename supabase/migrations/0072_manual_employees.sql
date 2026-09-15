-- Staff a reseller keeps by hand: people who work for them but have no
-- Jageer account (or don't need one). They're a record only - phone, work
-- hours, notes - so the reseller has their whole team in one place; jobs
-- can still only be sent through the app to a technician with an account
-- (see technician_employment).
-- Additive only. Safe to run once against the existing schema.

create table if not exists manual_employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  name text not null,
  phone text,
  job_title text,
  work_start_time time,
  work_end_time time,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manual_employees_owner_idx on manual_employees(owner_id, created_at);

alter table manual_employees enable row level security;

create policy manual_employees_all_owner on manual_employees
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy manual_employees_admin_all on manual_employees
  for all using (is_admin()) with check (is_admin());

create or replace function set_updated_at_manual_employees()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists manual_employees_set_updated_at on manual_employees;
create trigger manual_employees_set_updated_at
  before update on manual_employees
  for each row execute function set_updated_at_manual_employees();

-- Work hours are the employer's call. A technician may still propose hours
-- when applying (the insert) and may cancel or resign, but once a row
-- exists they can't move their own start/end times - only the reseller on
-- the row (or an admin) can.
create or replace function technician_employment_hours_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = new.technician_id
     and auth.uid() <> new.reseller_id
     and not is_admin()
     and (new.work_start_time is distinct from old.work_start_time
          or new.work_end_time is distinct from old.work_end_time) then
    raise exception 'work hours are set by your employer';
  end if;
  return new;
end;
$$;

drop trigger if exists technician_employment_hours_guard on technician_employment;
create trigger technician_employment_hours_guard
  before update on technician_employment
  for each row execute function technician_employment_hours_guard();
