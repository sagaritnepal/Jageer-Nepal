-- Client-saved reseller/technician contacts ("Saved Contacts"): lets a
-- customer bookmark a reseller or technician they've dealt with (from a
-- reseller's profile, a past service request, or the Home dashboard's
-- Recently Hired list) so they can find and call/message them again later
-- without hunting through old requests.
-- Additive only. Safe to run once against the existing schema.

create table if not exists saved_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id),
  contact_id uuid not null references profiles(id),
  note text,
  created_at timestamptz not null default now(),
  unique (client_id, contact_id)
);

create index if not exists saved_contacts_client_idx on saved_contacts(client_id, created_at);

alter table saved_contacts enable row level security;

create policy saved_contacts_all_owner on saved_contacts
  for all using (client_id = auth.uid())
  with check (client_id = auth.uid());

create policy saved_contacts_admin_all on saved_contacts
  for all using (is_admin()) with check (is_admin());
