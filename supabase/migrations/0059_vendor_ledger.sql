alter table vendor_ledger_entries enable row level security;

drop policy if exists vendor_ledger_entries_select on vendor_ledger_entries;
create policy vendor_ledger_entries_select on vendor_ledger_entries
  for select using (owner_id = auth.uid());

drop policy if exists vendor_ledger_entries_insert_manual on vendor_ledger_entries;
create policy vendor_ledger_entries_insert_manual on vendor_ledger_entries
  for insert with check (owner_id = auth.uid() and source = 'manual');

drop policy if exists vendor_ledger_entries_update_manual on vendor_ledger_entries;
create policy vendor_ledger_entries_update_manual on vendor_ledger_entries
  for update using (owner_id = auth.uid() and source = 'manual')
  with check (owner_id = auth.uid() and source = 'manual');

drop policy if exists vendor_ledger_entries_delete_manual on vendor_ledger_entries;
create policy vendor_ledger_entries_delete_manual on vendor_ledger_entries
  for delete using (owner_id = auth.uid() and source = 'manual');

drop policy if exists vendor_ledger_entries_admin_all on vendor_ledger_entries;
create policy vendor_ledger_entries_admin_all on vendor_ledger_entries
  for all using (is_admin()) with check (is_admin());