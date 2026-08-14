-- A technician can be directly employed by one reseller at a time (applies
-- to that reseller, reseller accepts/rejects) or stay in the general
-- outsource pool. An employer can assign their employee straight to a job
-- with no accept step (see assignTechnician.ts); outsource technicians keep
-- the existing "must accept" flow. While on duty (work_start_time to
-- work_end_time, checked client-side against local time), an employee is
-- exclusive to their employer and drops out of every other reseller's
-- technician pool - see useTechnicianRanking.ts.

create table if not exists technician_employment (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references profiles(id),
  reseller_id uuid not null references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'ended')),
  work_start_time time,
  work_end_time time,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  ended_at timestamptz
);

-- One active employer at a time - a technician can't be simultaneously
-- accepted by two resellers.
create unique index if not exists technician_employment_one_active_idx
  on technician_employment (technician_id)
  where status = 'accepted';

create index if not exists technician_employment_reseller_idx on technician_employment(reseller_id, status);
create index if not exists technician_employment_technician_idx on technician_employment(technician_id, status);

alter table technician_employment enable row level security;

-- Technicians see and manage only their own employment row (apply, cancel a
-- pending request, edit work hours once accepted, or resign).
create policy technician_employment_select_own on technician_employment
  for select using (technician_id = auth.uid() or reseller_id = auth.uid());

create policy technician_employment_insert_own on technician_employment
  for insert with check (technician_id = auth.uid());

create policy technician_employment_update_technician on technician_employment
  for update using (technician_id = auth.uid())
  with check (technician_id = auth.uid());

-- Resellers accept/reject a pending request or end an active employment.
create policy technician_employment_update_reseller on technician_employment
  for update using (reseller_id = auth.uid())
  with check (reseller_id = auth.uid());

create policy technician_employment_admin_all on technician_employment
  for all using (is_admin()) with check (is_admin());
