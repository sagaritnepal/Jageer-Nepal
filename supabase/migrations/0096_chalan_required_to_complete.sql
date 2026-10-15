-- A job cannot be marked complete without its chalan: the number written on the slip (chalan_no,
-- 0090) and at least one photo of it (chalan_urls, 0066).
--
-- The technician's screen has always asked for both before it lets a job be completed, but only the
-- screen did - the database accepted a completion with neither, from anything that called it
-- directly. This puts the same rule where it cannot be stepped around.
--
-- It applies at the moment a job moves INTO 'resolved'. Jobs that are already complete are left
-- alone, and a job that is reopened and completed again keeps the chalan it already has, so it passes.
-- The service role, the SQL editor and admins are not held to it (same exemption as the other guards
-- on service_requests, 0077), so a stuck job can still be put right by hand.
--
-- Run once, in the Supabase SQL Editor. Safe to run more than once.

create or replace function service_requests_require_chalan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only people using the app are held to it; admins and server-side work (current_user is the
  -- database owner, not 'authenticated') are not.
  if current_user in ('authenticated', 'anon') and not is_admin() then
    if nullif(btrim(coalesce(new.chalan_no, '')), '') is null then
      raise exception 'Add the chalan number before marking this job complete';
    end if;
    if coalesce(cardinality(new.chalan_urls), 0) = 0 then
      raise exception 'Add a photo of the chalan before marking this job complete';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists service_requests_require_chalan on service_requests;
create trigger service_requests_require_chalan
  before update on service_requests
  for each row
  when (new.status = 'resolved' and old.status is distinct from 'resolved')
  execute function service_requests_require_chalan();
