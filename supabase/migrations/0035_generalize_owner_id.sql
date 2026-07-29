-- customers, customer_ledger_entries, and business_transactions
-- (0033/0034) were built for resellers, but their "reseller_id" column was
-- never actually role-constrained -- every RLS policy on them just checks
-- "= auth.uid()". Wholesalers now get their own Finance tab (Payment
-- In/Out, Sales/Purchase/Expense, a customer/party directory) reusing these
-- same tables, so rename the column to what it's always really meant:
-- whichever profile owns this row.

alter table customers rename column reseller_id to owner_id;
alter table customer_ledger_entries rename column reseller_id to owner_id;
alter table business_transactions rename column reseller_id to owner_id;

alter index customers_reseller_idx rename to customers_owner_idx;
alter index business_transactions_reseller_idx rename to business_transactions_owner_idx;

drop policy customers_all_reseller on customers;
create policy customers_all_owner on customers
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy customer_ledger_entries_select on customer_ledger_entries;
create policy customer_ledger_entries_select on customer_ledger_entries
  for select using (owner_id = auth.uid());

drop policy customer_ledger_entries_insert_manual on customer_ledger_entries;
create policy customer_ledger_entries_insert_manual on customer_ledger_entries
  for insert with check (owner_id = auth.uid() and source = 'manual');

drop policy customer_ledger_entries_update_manual on customer_ledger_entries;
create policy customer_ledger_entries_update_manual on customer_ledger_entries
  for update using (owner_id = auth.uid() and source = 'manual')
  with check (owner_id = auth.uid() and source = 'manual');

drop policy customer_ledger_entries_delete_manual on customer_ledger_entries;
create policy customer_ledger_entries_delete_manual on customer_ledger_entries
  for delete using (owner_id = auth.uid() and source = 'manual');

drop policy business_transactions_all_reseller on business_transactions;
create policy business_transactions_all_owner on business_transactions
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- The booking-sync trigger's function body is opaque text, so the column
-- rename above doesn't rewrite it -- it must be redefined explicitly or it
-- would start failing at runtime on the next service_requests insert/update.
create or replace function sync_service_request_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.customer_id is null or new.quoted_price is null or new.quoted_price <= 0 or new.status = 'cancelled' then
    delete from customer_ledger_entries where source_type = 'service_request' and source_id = new.id;
    return new;
  end if;

  insert into customer_ledger_entries (customer_id, owner_id, entry_type, amount, note, source, source_type, source_id)
  values (new.customer_id, new.reseller_id, 'debit', new.quoted_price, new.issue_type, 'booking', 'service_request', new.id)
  on conflict (source_type, source_id)
  do update set amount = excluded.amount, customer_id = excluded.customer_id, note = excluded.note;

  return new;
end;
$$;
