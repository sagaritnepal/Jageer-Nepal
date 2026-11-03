-- An employer's own number for an employee on their team (e.g. "MTPL-05"), shown beside their name and
-- job title on the Detailed page of Requests.
-- Additive only. Safe to run once against the existing schema.

alter table technician_employment add column if not exists employee_code text;

-- Like the work hours, job title and role, it is the employer's to set - a technician can read their
-- own row but can't relabel themselves. Replaces the guard from 0077.
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
          or new.work_end_time is distinct from old.work_end_time
          or new.job_title is distinct from old.job_title
          or new.employer_note is distinct from old.employer_note
          or new.staff_role is distinct from old.staff_role
          or new.employee_code is distinct from old.employee_code) then
    raise exception 'work hours, job title, role and employee number are set by your employer';
  end if;
  return new;
end;
$$;
