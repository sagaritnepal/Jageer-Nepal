-- Employees by email: hand-added staff can have one stored, and a reseller
-- inviting a technician can find them by the email they signed up with.
-- Additive only. Safe to run once against the existing schema.

alter table manual_employees add column if not exists email text;

-- Sign-in emails live in auth.users, which RLS-bound clients can't read, so
-- the lookup runs as a definer function that only ever returns the one
-- technician profile matching an exact (case-insensitive) address - no
-- listing, no partial matches, nothing about any other role.
create or replace function find_technician_by_email(p_email text)
returns table (id uuid, full_name text, phone text, avatar_url text, city text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.phone, p.avatar_url, p.city
  from profiles p
  join auth.users u on u.id = p.id
  where p.role = 'technician'
    and lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

grant execute on function find_technician_by_email(text) to authenticated;
