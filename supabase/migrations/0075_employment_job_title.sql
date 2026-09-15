-- An employer's own labels for an employee who has a Jageer account, so
-- their page holds the same details as a hand-added person's: what they do
-- for this reseller, and the reseller's private note about them. Their
-- name, photo and phone still come from their own profile.
-- Additive only. Safe to run once against the existing schema.

alter table technician_employment add column if not exists job_title text;
alter table technician_employment add column if not exists employer_note text;

-- These belong to the employer, like the work hours - a technician can read
-- their own row but can't relabel themselves. Replaces the hours-only guard
-- from 0072.
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
          or new.employer_note is distinct from old.employer_note) then
    raise exception 'work hours and job title are set by your employer';
  end if;
  return new;
end;
$$;
