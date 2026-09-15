-- Resellers can now invite technicians to work for them, instead of only
-- waiting for a technician to apply. Both directions share one table; this
-- column says who started it, which decides who is allowed to accept.
alter table technician_employment
  add column if not exists initiated_by text not null default 'technician'
  check (initiated_by in ('technician', 'reseller'));

-- A reseller may create a pending invite for a real technician account.
drop policy if exists technician_employment_insert_reseller_invite on technician_employment;
create policy technician_employment_insert_reseller_invite on technician_employment
  for insert with check (
    reseller_id = auth.uid()
    and initiated_by = 'reseller'
    and status = 'pending'
    and public."current_role"() = 'reseller'::user_role
    and exists (select 1 from profiles p where p.id = technician_id and p.role = 'technician')
  );

-- The other side has to accept: a technician accepts a reseller's invite,
-- a reseller accepts a technician's application. Both update policies let
-- either party edit the row, so without this a reseller could accept their
-- own invite (or a technician their own application) and skip consent.
create or replace function technician_employment_guard_accept() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status = 'pending' and not is_admin() then
    if old.initiated_by = 'reseller' and auth.uid() is distinct from old.technician_id then
      raise exception 'Only the technician can accept this invite';
    end if;
    if old.initiated_by = 'technician' and auth.uid() is distinct from old.reseller_id then
      raise exception 'Only the reseller can accept this request';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists technician_employment_guard_accept on technician_employment;
create trigger technician_employment_guard_accept
  before update on technician_employment
  for each row execute function technician_employment_guard_accept();

-- One open invite/application per technician-reseller pair, so tapping
-- "Invite" twice doesn't stack duplicates.
create unique index if not exists technician_employment_one_pending_pair_idx
  on technician_employment (technician_id, reseller_id)
  where status = 'pending';
