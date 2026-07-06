-- Support tickets: lets any user report an issue; admins triage and resolve.
-- Additive only. Safe to run once against the existing schema.

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_idx on support_tickets(user_id);

alter table support_tickets enable row level security;

create policy support_tickets_insert_own on support_tickets
  for insert with check (user_id = auth.uid());

create policy support_tickets_select on support_tickets
  for select using (user_id = auth.uid() or is_admin());

create policy support_tickets_update_admin on support_tickets
  for update using (is_admin()) with check (is_admin());
